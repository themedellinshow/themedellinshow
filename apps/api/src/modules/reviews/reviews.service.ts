import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Review, ReviewStatus } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { BookingsService } from '../bookings/bookings.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    private bookingsService: BookingsService,
    private httpService: HttpService,
    private config: ConfigService,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto): Promise<Review> {
    const booking = await this.bookingsService.findById(dto.bookingId);

    if (booking.travelerId !== reviewerId) {
      throw new ForbiddenException('Only the traveler can review this booking');
    }

    if (booking.status !== 'completed') {
      throw new BadRequestException('Can only review completed bookings');
    }

    // Check if review already exists
    const existing = await this.reviewRepo.findOne({ where: { bookingId: dto.bookingId } });
    if (existing) {
      throw new BadRequestException('Review already submitted for this booking');
    }

    const review = this.reviewRepo.create({
      bookingId: dto.bookingId,
      experienceId: booking.experienceId,
      reviewerId,
      hostId: booking.hostId,
      rating: dto.rating,
      content: dto.content,
      language: dto.language,
      hostRating: dto.hostRating,
      valueRating: dto.valueRating,
      accuracyRating: dto.accuracyRating,
      imageUrls: dto.imageUrls,
      verified: true, // Verified purchase
      status: 'pending_moderation',
    });

    const saved = await this.reviewRepo.save(review);

    // Send to AI Gateway for moderation
    this.moderateReview(saved.id, dto.content);

    return saved;
  }

  async findById(id: string): Promise<Review> {
    const review = await this.reviewRepo.findOne({
      where: { id },
      relations: ['reviewer', 'experience'],
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async findByExperience(experienceId: string, onlyApproved = true): Promise<Review[]> {
    const where: any = { experienceId };
    if (onlyApproved) {
      where.status = 'approved';
    }
    return this.reviewRepo.find({
      where,
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByHost(hostId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { hostId },
      relations: ['experience', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async addHostResponse(id: string, hostId: string, response: string): Promise<Review> {
    const review = await this.findById(id);
    if (review.hostId !== hostId) {
      throw new ForbiddenException('Not authorized');
    }
    review.hostResponse = response;
    review.hostRespondedAt = new Date();
    return this.reviewRepo.save(review);
  }

  async updateStatus(id: string, status: ReviewStatus, note?: string): Promise<Review> {
    const review = await this.findById(id);
    review.status = status;
    review.moderationNote = note ?? null;
    review.moderatedAt = new Date();

    const saved = await this.reviewRepo.save(review);

    // Update experience rating if approved
    if (status === 'approved') {
      await this.updateExperienceRating(review.experienceId);
    }

    return saved;
  }

  async markHelpful(id: string): Promise<Review> {
    const review = await this.findById(id);
    review.helpfulCount += 1;
    return this.reviewRepo.save(review);
  }

  private async moderateReview(reviewId: string, content: string): Promise<void> {
    try {
      const aiGatewayUrl = this.config.get('AI_GATEWAY_URL', 'http://localhost:3002');
      const response = await firstValueFrom(
        this.httpService.post(`${aiGatewayUrl}/ai/v1/moderation/check`, {
          contentType: 'review',
          content,
        }),
      );

      const result = response.data;
      if (result.approved) {
        await this.updateStatus(reviewId, 'approved');
      } else {
        await this.updateStatus(reviewId, 'pending_moderation', result.reason);
      }
    } catch {
      // If AI moderation fails, leave as pending for manual review
    }
  }

  private async updateExperienceRating(experienceId: string): Promise<void> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('review.experienceId = :experienceId', { experienceId })
      .andWhere('review.status = :status', { status: 'approved' })
      .getRawOne();

    // This would update the experience - simplified for now
    // In real implementation, inject ExperiencesService
  }
}
