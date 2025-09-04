'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { z } from 'zod';

const ticketSchema = z.object({
  requestType: z.enum(['quote', 'coa', 'freight', 'claim', 'other']),
  customerName: z.string().optional(),
  customerEmail: z.string().optional().refine((val) => !val || z.string().email().safeParse(val).success, 'Valid email required'),
  customerPhone: z.string().optional().refine((val) => !val || val.replace(/\D/g, '').length >= 10, 'Valid phone number required'),
  summary: z.string().min(10, 'Please provide a brief description'),
}).refine(
  (data) => data.customerEmail || data.customerPhone,
  {
    message: "Either email or phone number is required",
    path: ["customerEmail"]
  }
);

const customerSchema = z.object({
  customerEmail: z.string().optional().refine((val) => !val || z.string().email().safeParse(val).success, 'Valid email required'),
  customerPhone: z.string().optional().refine((val) => !val || val.length >= 10, 'Valid phone number required'),
  customerName: z.string().optional(),
}).refine(
  (data) => data.customerEmail || data.customerPhone,
  {
    message: "Either email or phone number is required",
    path: ["customerEmail"]
  }
);

type TicketFormData = z.infer<typeof ticketSchema>;

const requestTypes = [
  { value: 'quote', label: 'Quote Request', color: 'bg-blue-500' },
  { value: 'coa', label: 'COA Request', color: 'bg-purple-500' },
  { value: 'freight', label: 'Freight/Shipping', color: 'bg-orange-500' },
  { value: 'claim', label: 'Claim/Issue', color: 'bg-red-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];


export default function IntakePage() {
  const searchParams = useSearchParams();
  const callId = searchParams.get('callId');
  const fromNumber = searchParams.get('from');
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<TicketFormData>>({
    requestType: 'other',
    customerName: '',
    customerEmail: '',
    customerPhone: fromNumber || '',
    summary: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Customer sync state
  const [customerData, setCustomerData] = useState<any>(null);
  const [customerSyncing, setCustomerSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasCustomer, setHasCustomer] = useState(false);
  const [searchCache, setSearchCache] = useState<Record<string, any>>({});
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Network status tracking
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      // Process pending customer syncs
      const pending = Object.keys(localStorage)
        .filter(k => k.startsWith('pending_customer_'))
        .map(k => {
          try {
            return { key: k, data: JSON.parse(localStorage.getItem(k) || '{}') };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      pending.forEach((item) => {
        if (item && (item.data.email || item.data.phone)) {
          syncCustomerData(item.data.email, item.data.phone);
          localStorage.removeItem(item.key);
        }
      });
    };
    
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Process any pending syncs on load
    handleOnline();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Trigger customer sync when email or phone is entered
    if ((name === 'customerEmail' && value && value.includes('@')) || 
        (name === 'customerPhone' && value && value.length >= 10)) {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      emailTimeoutRef.current = setTimeout(() => {
        syncCustomerData(formData.customerEmail || value, formData.customerPhone || value);
      }, 500);
    }
  };
  
  // Sync customer data from Shopify
  const syncCustomerData = async (email?: string, phone?: string) => {
    if (!email && !phone) return;
    
    setCustomerSyncing(true);
    try {
      const response = await fetch('/api/customers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || formData.customerEmail,
          phone: phone || formData.customerPhone,
          name: formData.customerName,
          createIfNotFound: true // Auto-create customer when info is entered
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
        
        // Auto-fill form fields with enriched data
        if (data.customer) {
          setFormData(prev => ({
            ...prev,
            customerName: data.customer.name || prev.customerName,
            customerPhone: data.customer.phone || prev.customerPhone,
            customerEmail: email, // Keep the email they typed
          }));
        }
      }
    } catch (error) {
      console.error('Customer sync error:', error);
            // Save to localStorage for retry when online
            {
              const keyId = email || phone || 'unknown';
              localStorage.setItem(`pending_customer_${keyId}`, JSON.stringify({
                email,
                phone,
                name: formData.customerName,
                timestamp: Date.now()
              }));
            }
    } finally {
      setCustomerSyncing(false);
    }
  };


  const handleContinue = () => {
    try {
      customerSchema.parse(formData);
      setHasCustomer(true);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleGoBack = () => {
    setHasCustomer(false);
    setCustomerData(null);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const validatedData = ticketSchema.parse(formData);
      
      // Ensure customer exists in Shopify/local
      if (validatedData.customerEmail || validatedData.customerPhone) {
        const syncResponse = await fetch('/api/customers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: validatedData.customerEmail,
            name: validatedData.customerName,
            phone: validatedData.customerPhone,
            createIfNotFound: true // Create in Shopify if not found
          })
        });
        
        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          // Use the synced customer ID
          if (syncData.customer) {
            (validatedData as any).customerId = syncData.customer.id;
          }
        }
      }
      
      const ticketData = {
        ...validatedData,
        callId,
        enableAI: true,
        priority: 'normal', // Default priority
        data: {
          source: 'intake-form',
          callScreenPop: !!callId,
          customerData: customerData?.enrichedData // Include enriched data
        }
      };

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        throw new Error('Failed to create ticket');
      }

      setSubmitSuccess(true);
      
      setTimeout(() => {
        setFormData({
          requestType: 'other',
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          summary: '',
        });
        setSubmitSuccess(false);
      }, 3000);

    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ submit: 'Failed to create ticket. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          input::placeholder, textarea::placeholder {
            color: #9ca3af !important;
            opacity: 1;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          @keyframes slideIn {
            from { 
              opacity: 0; 
              transform: translateY(-10px); 
            }
            to { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
          .customer-card {
            animation: slideIn 0.3s ease-out;
          }
        `
      }} />
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px 0' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            {hasCustomer ? 'What do you need?' : 'Customer Information'}
          </h1>
          {callId && (
            <p style={{ fontSize: '14px', color: '#10b981', marginTop: '4px' }}>
              📞 Active call from {fromNumber}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        {submitSuccess ? (
          <div style={{ backgroundColor: '#d1fae5', border: '1px solid #10b981', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <p style={{ color: '#065f46', fontWeight: '500' }}>
              ✅ Ticket created successfully! Our team will respond shortly.
            </p>
          </div>
        ) : null}

        <form onSubmit={hasCustomer ? handleSubmit : (e) => { e.preventDefault(); handleContinue(); }}>
          {hasCustomer && (
            <>
              {/* Request Type */}
              <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                  Request Type
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  {requestTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, requestType: type.value as any }))}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        border: formData.requestType === type.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                        backgroundColor: formData.requestType === type.value ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}


          {/* Contact Information */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {!hasCustomer && (
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                Customer Information
                {customerSyncing && (
                  <span style={{ marginLeft: '10px', fontSize: '14px', color: '#6b7280', fontWeight: 'normal' }}>
                    🔄 Looking up customer...
                  </span>
                )}
                {!isOnline && (
                  <span style={{ marginLeft: '10px', fontSize: '14px', color: '#f59e0b', fontWeight: 'normal' }}>
                    📶 Offline - will sync when connected
                  </span>
                )}
              </h2>
            )}
            
            {hasCustomer && (
              <div className="customer-card" style={{ 
                fontSize: '14px', 
                color: '#064e3b', 
                marginBottom: '20px', 
                padding: '16px', 
                background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', 
                borderRadius: '12px',
                border: '1px solid #10b981',
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.1)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ fontWeight: '700', marginBottom: '12px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '20px', 
                      height: '20px', 
                      backgroundColor: '#10b981', 
                      borderRadius: '50%', 
                      position: 'relative'
                    }}>
                      <span style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)', 
                        color: 'white', 
                        fontSize: '12px' 
                      }}>✓</span>
                    </span>
                    Customer: {formData.customerName || formData.customerEmail} • {formData.customerPhone}
                  </div>
                  <button 
                    type="button"
                    onClick={handleGoBack}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      color: '#047857',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    ← Edit
                  </button>
                </div>
                
                {customerData && (
                  <div style={{ fontSize: '13px', color: '#047857', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                    {/* Shopify Data */}
                    {customerData.externalData?.shopify && (
                      <div style={{ 
                        padding: '12px', 
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                        borderRadius: '8px',
                        border: '1px solid #6ee7b7',
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📦 <span>Shopify History</span>
                        </div>
                        <div>Orders: {customerData.externalData.shopify.ordersCount || 0}</div>
                        <div>Total Spent: ${customerData.externalData.shopify.totalSpent || 0}</div>
                        {customerData.externalData.shopify.tags && (
                          <div>Tags: {customerData.externalData.shopify.tags}</div>
                        )}
                        {customerData.enrichedData?.lastOrderDate && (
                          <div>Last Order: {new Date(customerData.enrichedData.lastOrderDate).toLocaleDateString()}</div>
                        )}
                        
                        {/* Recent Orders */}
                        {customerData.externalData.shopify.recent_orders && customerData.externalData.shopify.recent_orders.length > 0 && (
                          <div style={{ 
                            marginTop: '8px', 
                            padding: '8px', 
                            background: 'rgba(240, 253, 244, 0.8)', 
                            borderRadius: '6px',
                            border: '1px solid rgba(110, 231, 183, 0.3)'
                          }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#065f46' }}>🛒 Recent Orders:</div>
                            {customerData.externalData.shopify.recent_orders.slice(0, 2).map((order: any, idx: number) => (
                              <div key={idx} style={{ 
                                fontSize: '11px', 
                                marginBottom: '3px',
                                padding: '3px 6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                borderRadius: '3px'
                              }}>
                                <div style={{ fontWeight: '600', color: '#047857' }}>
                                  #{order.order_number} - ${order.total_price}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: '10px' }}>
                                  {new Date(order.created_at).toLocaleDateString()}
                                </div>
                                {order.line_items && order.line_items.length > 0 && (
                                  <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '1px' }}>
                                    {order.line_items[0].title} {order.line_items.length > 1 && `+${order.line_items.length - 1} more`}
                                  </div>
                                )}
                              </div>
                            ))}
                            {customerData.externalData.shopify.recent_orders.length > 2 && (
                              <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
                                +{customerData.externalData.shopify.recent_orders.length - 2} more orders
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    
                    
                    {/* Company Info */}
                    {customerData.enrichedData?.company && (
                      <div style={{ padding: '8px', backgroundColor: '#ecfdf5', borderRadius: '4px', gridColumn: 'span 2' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>🏢 Company: {customerData.enrichedData.company}</div>
                      </div>
                    )}
                    
                    {/* Addresses */}
                    {customerData.enrichedData?.addresses?.length > 0 && (
                      <div style={{ padding: '8px', backgroundColor: '#ecfdf5', borderRadius: '4px', gridColumn: 'span 2' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>📍 Known Addresses:</div>
                        {customerData.enrichedData.addresses.slice(0, 3).map((addr: any, idx: number) => (
                          <div key={idx} style={{ marginLeft: '10px', marginBottom: '2px' }}>
                            • {addr.address1}{addr.city && `, ${addr.city}`} {addr.state} {addr.zip}
                          </div>
                        ))}
                        {customerData.enrichedData.addresses.length > 3 && (
                          <div style={{ marginLeft: '10px', fontStyle: 'italic' }}>
                            +{customerData.enrichedData.addresses.length - 3} more addresses
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Notes */}
                    {customerData.enrichedData?.notes?.length > 0 && (
                      <div style={{ padding: '8px', backgroundColor: '#ecfdf5', borderRadius: '4px', gridColumn: 'span 2' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>📝 Notes:</div>
                        {customerData.enrichedData.notes.slice(0, 2).map((note: string, idx: number) => (
                          <div key={idx} style={{ marginLeft: '10px', marginBottom: '2px', fontSize: '12px' }}>
                            • {note.length > 80 ? `${note.substring(0, 80)}...` : note}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Show this if no customer data found yet */}
                {!customerData && customerSyncing && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#047857', 
                    fontStyle: 'italic', 
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'rgba(240, 253, 244, 0.5)',
                    borderRadius: '6px',
                    textAlign: 'center',
                    animation: 'pulse 2s infinite'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        border: '2px solid #10b981', 
                        borderTop: '2px solid transparent', 
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Searching customer history...
                    </div>
                  </div>
                )}
                
                {/* Show if customer not found */}
                {!customerData && !customerSyncing && hasCustomer && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#d97706', 
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    ⚡ New customer - will be added to Shopify
                  </div>
                )}
              </div>
            )}
            
            {/* Customer Data Display */}
            {customerData && customerData.customer && (
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #60a5fa',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
                  ✅ Existing Customer Found
                </div>
                <div style={{ fontSize: '13px', color: '#1e40af', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {customerData.syncStatus?.shopify === 'existing' && (
                    <div>
                      <strong>Shopify:</strong> {customerData.externalData?.shopify?.ordersCount || 0} orders, 
                      ${customerData.externalData?.shopify?.totalSpent || 0} spent
                    </div>
                  )}
                  {customerData.enrichedData?.company && (
                    <div><strong>Company:</strong> {customerData.enrichedData.company}</div>
                  )}
                  {customerData.enrichedData?.lastOrderDate && (
                    <div><strong>Last Order:</strong> {new Date(customerData.enrichedData.lastOrderDate).toLocaleDateString()}</div>
                  )}
                </div>
                {customerData.enrichedData?.addresses?.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#1e40af' }}>
                    <strong>Known Addresses:</strong>
                    {customerData.enrichedData.addresses.slice(0, 2).map((addr: any, idx: number) => (
                      <div key={idx} style={{ marginLeft: '10px', marginTop: '4px' }}>
                        {addr.address1} {addr.city && `, ${addr.city}`} {addr.state}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!hasCustomer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>
                  Enter email or phone to look up. Email is required to create a new customer.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      name="customerEmail"
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#111827'
                      }}
                      placeholder="john@company.com"
                    />
                    {errors.customerEmail && (
                      <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.customerEmail}</p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="customerPhone"
                      value={formData.customerPhone}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#111827'
                      }}
                      placeholder="(555) 123-4567"
                    />
                    {errors.customerPhone && (
                      <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.customerPhone}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Full Name (optional)
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '16px',
                      color: '#111827'
                    }}
                    placeholder="Will auto-fill if customer exists"
                  />
                </div>
              </div>
            )}
          </div>

          {hasCustomer && (
            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                Description
              </h2>
              <div>
                <textarea
                  name="summary"
                  value={formData.summary}
                  onChange={handleInputChange}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px',
                    color: '#111827',
                    resize: 'vertical'
                  }}
                  placeholder="Briefly describe what they need..."
                  required
                />
                {errors.summary && (
                  <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.summary}</p>
                )}
              </div>
            </div>
          )}

          {errors.submit && (
            <div style={{ backgroundColor: '#fecaca', border: '1px solid #dc2626', borderRadius: '8px', padding: '12px', marginBottom: '24px' }}>
              <p style={{ color: '#7f1d1d', fontSize: '14px' }}>{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (!hasCustomer && (!formData.customerEmail && !formData.customerPhone))}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: loading ? '#9ca3af' : 
                             !hasCustomer ? '#10b981' : '#2563eb',
              color: 'white',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? (hasCustomer ? 'Creating Ticket...' : 'Saving Customer...') : 
             !hasCustomer ? 'Continue →' : 'Create Ticket'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
