interface NotificationTemplate {
  subject: { es: string; en: string; pt: string };
  emailTemplateId: string;
  whatsappTemplate: { es: string; en: string; pt: string };
  smsTemplate: { es: string; en: string; pt: string };
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  BOOKING_CREATED: {
    subject: {
      es: 'Reserva recibida - {{bookingRef}}',
      en: 'Booking received - {{bookingRef}}',
      pt: 'Reserva recebida - {{bookingRef}}',
    },
    emailTemplateId: 'd-booking-created',
    whatsappTemplate: {
      es: 'Hola {{name}}! Tu reserva {{bookingRef}} ha sido recibida para {{experienceName}} el {{date}} a las {{time}}. Te confirmaremos pronto.',
      en: 'Hi {{name}}! Your booking {{bookingRef}} has been received for {{experienceName}} on {{date}} at {{time}}. We will confirm soon.',
      pt: 'Olá {{name}}! Sua reserva {{bookingRef}} foi recebida para {{experienceName}} em {{date}} às {{time}}. Confirmaremos em breve.',
    },
    smsTemplate: {
      es: 'Reserva {{bookingRef}} recibida. Confirmaremos pronto - The Medellín Show',
      en: 'Booking {{bookingRef}} received. Will confirm soon - The Medellín Show',
      pt: 'Reserva {{bookingRef}} recebida. Confirmaremos em breve - The Medellín Show',
    },
  },

  BOOKING_CONFIRMED: {
    subject: {
      es: 'Reserva confirmada - {{bookingRef}}',
      en: 'Booking confirmed - {{bookingRef}}',
      pt: 'Reserva confirmada - {{bookingRef}}',
    },
    emailTemplateId: 'd-booking-confirmed',
    whatsappTemplate: {
      es: 'Hola {{name}}! Tu reserva {{bookingRef}} está CONFIRMADA. {{experienceName}} el {{date}} a las {{time}}. Punto de encuentro: {{meetingPoint}}',
      en: 'Hi {{name}}! Your booking {{bookingRef}} is CONFIRMED. {{experienceName}} on {{date}} at {{time}}. Meeting point: {{meetingPoint}}',
      pt: 'Olá {{name}}! Sua reserva {{bookingRef}} está CONFIRMADA. {{experienceName}} em {{date}} às {{time}}. Ponto de encontro: {{meetingPoint}}',
    },
    smsTemplate: {
      es: 'Reserva {{bookingRef}} CONFIRMADA para {{date}}. Detalles en tu email.',
      en: 'Booking {{bookingRef}} CONFIRMED for {{date}}. Details in your email.',
      pt: 'Reserva {{bookingRef}} CONFIRMADA para {{date}}. Detalhes no seu email.',
    },
  },

  PAYMENT_RECEIVED: {
    subject: {
      es: 'Pago recibido - {{bookingRef}}',
      en: 'Payment received - {{bookingRef}}',
      pt: 'Pagamento recebido - {{bookingRef}}',
    },
    emailTemplateId: 'd-payment-received',
    whatsappTemplate: {
      es: 'Hola {{name}}! Recibimos tu pago de {{amount}} {{currency}} para la reserva {{bookingRef}}. ¡Gracias!',
      en: 'Hi {{name}}! We received your payment of {{amount}} {{currency}} for booking {{bookingRef}}. Thank you!',
      pt: 'Olá {{name}}! Recebemos seu pagamento de {{amount}} {{currency}} para a reserva {{bookingRef}}. Obrigado!',
    },
    smsTemplate: {
      es: 'Pago de {{amount}} {{currency}} recibido para {{bookingRef}}.',
      en: 'Payment of {{amount}} {{currency}} received for {{bookingRef}}.',
      pt: 'Pagamento de {{amount}} {{currency}} recebido para {{bookingRef}}.',
    },
  },

  HOST_NEW_BOOKING: {
    subject: {
      es: 'Nueva reserva - {{bookingRef}}',
      en: 'New booking - {{bookingRef}}',
      pt: 'Nova reserva - {{bookingRef}}',
    },
    emailTemplateId: 'd-host-new-booking',
    whatsappTemplate: {
      es: 'Hola {{name}}! Tienes una nueva reserva {{bookingRef}} para {{experienceName}} el {{date}} ({{participants}} personas). Revisa y confirma.',
      en: 'Hi {{name}}! You have a new booking {{bookingRef}} for {{experienceName}} on {{date}} ({{participants}} people). Please review and confirm.',
      pt: 'Olá {{name}}! Você tem uma nova reserva {{bookingRef}} para {{experienceName}} em {{date}} ({{participants}} pessoas). Por favor revise e confirme.',
    },
    smsTemplate: {
      es: 'Nueva reserva {{bookingRef}} para {{date}}. Revisa en la app.',
      en: 'New booking {{bookingRef}} for {{date}}. Check the app.',
      pt: 'Nova reserva {{bookingRef}} para {{date}}. Verifique no app.',
    },
  },

  BOOKING_REMINDER: {
    subject: {
      es: 'Recordatorio: Tu experiencia es mañana',
      en: 'Reminder: Your experience is tomorrow',
      pt: 'Lembrete: Sua experiência é amanhã',
    },
    emailTemplateId: 'd-booking-reminder',
    whatsappTemplate: {
      es: 'Hola {{name}}! Recordatorio: {{experienceName}} es MAÑANA a las {{time}}. Punto de encuentro: {{meetingPoint}}. ¡Te esperamos!',
      en: 'Hi {{name}}! Reminder: {{experienceName}} is TOMORROW at {{time}}. Meeting point: {{meetingPoint}}. See you there!',
      pt: 'Olá {{name}}! Lembrete: {{experienceName}} é AMANHÃ às {{time}}. Ponto de encontro: {{meetingPoint}}. Te esperamos!',
    },
    smsTemplate: {
      es: 'Recordatorio: {{experienceName}} mañana a las {{time}}.',
      en: 'Reminder: {{experienceName}} tomorrow at {{time}}.',
      pt: 'Lembrete: {{experienceName}} amanhã às {{time}}.',
    },
  },
};
