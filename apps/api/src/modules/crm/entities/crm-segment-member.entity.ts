import { Entity, PrimaryColumn } from 'typeorm';

@Entity('crm_segment_members')
export class CrmSegmentMember {
  @PrimaryColumn({ type: 'uuid' })
  segmentId: string;

  @PrimaryColumn({ type: 'uuid' })
  contactId: string;
}