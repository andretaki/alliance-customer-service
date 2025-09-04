import { faker } from '@faker-js/faker';

export class TestFactory {
  static createCustomer() {
    return {
      email: faker.internet.email().toLowerCase(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      company: faker.company.name(),
      phone: faker.phone.number(),
      source: 'manual',
      syncToShopify: true,
      syncToQuickbooks: true,
      tags: faker.helpers.arrayElements(['vip', 'wholesale', 'retail', 'distributor'], 2),
    };
  }

  static createAddress() {
    return {
      type: faker.helpers.arrayElement(['billing', 'shipping']),
      address1: faker.location.streetAddress(),
      address2: faker.location.secondaryAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      country: 'US',
      isDefault: faker.datatype.boolean(),
    };
  }

  static createTicket() {
    const types = ['quote', 'coa', 'freight', 'claim', 'other'];
    const priorities = ['low', 'medium', 'high', 'urgent'];
    
    return {
      subject: faker.lorem.sentence(),
      description: faker.lorem.paragraphs(2),
      type: faker.helpers.arrayElement(types),
      priority: faker.helpers.arrayElement(priorities),
      status: 'open',
      source: faker.helpers.arrayElement(['email', 'phone', 'web', 'api']),
      metadata: {
        products: faker.helpers.arrayElements([
          'Sulfuric Acid',
          'Hydrochloric Acid',
          'Sodium Hydroxide',
          'Caustic Soda',
        ], 2),
        orderNumber: faker.string.alphanumeric(8).toUpperCase(),
      },
    };
  }

  static createCall() {
    return {
      callId: faker.string.uuid(),
      direction: faker.helpers.arrayElement(['inbound', 'outbound']),
      from: faker.phone.number(),
      to: faker.phone.number(),
      duration: faker.number.int({ min: 30, max: 600 }),
      status: faker.helpers.arrayElement(['answered', 'missed', 'voicemail']),
      recordingUrl: faker.internet.url(),
      timestamp: faker.date.recent().toISOString(),
    };
  }

  static createFreightInquiry() {
    return {
      origin: {
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
      },
      destination: {
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
      },
      product: faker.helpers.arrayElement(['Sulfuric Acid', 'Hydrochloric Acid', 'Sodium Hydroxide']),
      quantity: faker.number.int({ min: 1000, max: 50000 }),
      unit: faker.helpers.arrayElement(['lbs', 'gal', 'drums']),
      hazmat: true,
      requiredDate: faker.date.future().toISOString(),
      notes: faker.lorem.sentence(),
    };
  }

  static createCOADocument() {
    return {
      lotNumber: faker.string.alphanumeric(10).toUpperCase(),
      productName: faker.helpers.arrayElement(['Sulfuric Acid 98%', 'Hydrochloric Acid 32%']),
      productCode: faker.string.alphanumeric(6).toUpperCase(),
      manufactureDate: faker.date.recent().toISOString(),
      expirationDate: faker.date.future().toISOString(),
      specifications: {
        purity: faker.number.float({ min: 95, max: 99.9, fractionDigits: 1 }),
        ph: faker.number.float({ min: 0, max: 14, fractionDigits: 1 }),
        density: faker.number.float({ min: 1.0, max: 2.0, fractionDigits: 3 }),
      },
      fileUrl: faker.internet.url(),
      metadata: {
        lab: faker.company.name(),
        technician: faker.person.fullName(),
      },
    };
  }

  static createWebhookPayload() {
    return {
      event: faker.helpers.arrayElement(['call.started', 'call.ended', 'call.missed']),
      timestamp: faker.date.recent().toISOString(),
      signature: faker.string.alphanumeric(64),
      data: {
        callId: faker.string.uuid(),
        from: faker.phone.number(),
        to: faker.phone.number(),
      },
    };
  }

  static createAITestCase() {
    return {
      operation: faker.helpers.arrayElement(['classify', 'sentiment', 'suggest', 'summarize']),
      input: faker.lorem.paragraph(),
      expectedOutput: {
        type: faker.helpers.arrayElement(['quote', 'coa', 'freight', 'claim']),
        confidence: faker.number.float({ min: 0.7, max: 1.0, fractionDigits: 2 }),
      },
    };
  }
}