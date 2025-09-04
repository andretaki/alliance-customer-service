// Test data configuration for AI testing and examples
// These values are used for testing AI functionality
// Update these with real examples from your business

export const TEST_DATA = {
  // Sample customer request for AI testing
  sampleRequest: `I need a quote for 500 gallons of isopropyl alcohol delivered to our facility in Dallas by next week. 
    This is urgent as our current inventory is running low. My name is Sarah Johnson from TechChem Industries. 
    You can reach me at sarah.johnson@techchem.com or 214-555-7890. Our purchase order number is PO-2024-TCH-3847.`,
  
  // Example entities for AI extraction demonstrations
  exampleEntities: {
    customerName: "Sarah Johnson",
    companyName: "TechChem Industries",
    phoneNumbers: ["214-555-7890"],
    emails: ["sarah.johnson@techchem.com"],
    addresses: ["1234 Industrial Blvd, Dallas, TX 75201"],
    products: [
      { name: "Isopropyl Alcohol", quantity: 500, unit: "gallons" }
    ],
    orderNumbers: ["PO-2024-TCH-3847"],
    trackingNumbers: ["TRK-DAL-98765"],
    dates: { delivery: "2024-12-20" },
    amounts: [
      { value: 2500, currency: "USD", type: "invoice" }
    ]
  }
};

// Real email addresses for notifications
export const NOTIFICATION_EMAILS = {
  // Team member emails - Update with actual Alliance Chemical emails
  assignees: {
    'Adnan': process.env.EMAIL_ADNAN || 'adnan@alliancechemical.com',
    'Lori': process.env.EMAIL_LORI || 'lori@alliancechemical.com',
    'sales-team': process.env.EMAIL_SALES || 'sales@alliancechemical.com',
    'coa-team': process.env.EMAIL_COA || 'coa@alliancechemical.com',
    'logistics-team': process.env.EMAIL_LOGISTICS || 'logistics@alliancechemical.com',
    'customer-service': process.env.EMAIL_SUPPORT || 'support@alliancechemical.com',
  },
  
  // Escalation recipients
  escalation: {
    supervisor: process.env.EMAIL_SUPERVISOR || 'supervisor@alliancechemical.com',
    manager: process.env.EMAIL_MANAGER || 'manager@alliancechemical.com',
    coo: process.env.EMAIL_COO || 'coo@alliancechemical.com'
  },
  
  // Default support email
  defaultSupport: process.env.EMAIL_DEFAULT_SUPPORT || 'support@alliancechemical.com'
};

// Form placeholder text - Update with your preferred examples
export const FORM_PLACEHOLDERS = {
  customerName: "Sarah Johnson",
  email: "sarah.johnson@techchem.com",
  phone: "(555) 123-4567",
  company: "TechChem Industries",
  message: "I need a quote for isopropyl alcohol...",
  productName: "Isopropyl Alcohol",
  quantity: "500 gallons",
  deliveryLocation: "Dallas, TX"
};