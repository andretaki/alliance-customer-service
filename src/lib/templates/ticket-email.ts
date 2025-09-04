interface TicketEmailData {
  id: number;
  requestType: string;
  status: string;
  priority?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  summary?: string;
  data?: any;
  assignee?: string;
  aiClassification?: any;
  aiSentiment?: string;
  aiSentimentScore?: number;
  createdAt: Date;
}

export const ticketEmail = (ticket: TicketEmailData): string => {
  const priorityColors: Record<string, string> = {
    urgent: '#dc3545',
    high: '#fd7e14',
    normal: '#28a745',
    low: '#6c757d'
  };

  const sentimentEmojis: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😟'
  };

  const priorityColor = priorityColors[ticket.priority || 'normal'] || priorityColors.normal;
  const sentimentEmoji = ticket.aiSentiment ? sentimentEmojis[ticket.aiSentiment] || '' : '';

  // Extract product details if available
  const products = ticket.data?.products || [];
  const productRows = products.map((p: any) => 
    `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #dee2e6">${p.name || 'N/A'}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #dee2e6">${p.quantity || ''} ${p.unit || ''}</td>
    </tr>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f8f9fa">
  <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;background:#f8f9fa">
    <tr>
      <td align="center" style="padding:20px 0">
        <table role="presentation" style="width:600px;border-collapse:collapse;border:1px solid #dee2e6;border-spacing:0;background:#ffffff;border-radius:8px">
          <!-- Header -->
          <tr>
            <td style="padding:20px;background:${priorityColor};border-radius:8px 8px 0 0">
              <table role="presentation" style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="color:#ffffff">
                    <h1 style="margin:0;font-size:24px">New Ticket #${ticket.id}</h1>
                    <p style="margin:5px 0 0 0;font-size:14px;opacity:0.9">
                      ${ticket.requestType.toUpperCase()} • ${ticket.priority?.toUpperCase() || 'NORMAL'} Priority
                    </p>
                  </td>
                  ${ticket.aiSentiment ? `
                  <td align="right" style="color:#ffffff;font-size:32px">
                    ${sentimentEmoji}
                  </td>
                  ` : ''}
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Customer Information -->
          <tr>
            <td style="padding:20px">
              <h2 style="margin:0 0 15px 0;font-size:18px;color:#333">Customer Information</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:8px 0;width:120px;color:#666"><strong>Name:</strong></td>
                  <td style="padding:8px 0;color:#333">${ticket.customerName || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#666"><strong>Email:</strong></td>
                  <td style="padding:8px 0;color:#333">
                    ${ticket.customerEmail ? `<a href="mailto:${ticket.customerEmail}" style="color:#007bff;text-decoration:none">${ticket.customerEmail}</a>` : 'Not provided'}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#666"><strong>Phone:</strong></td>
                  <td style="padding:8px 0;color:#333">
                    ${ticket.customerPhone ? `<a href="tel:${ticket.customerPhone}" style="color:#007bff;text-decoration:none">${ticket.customerPhone}</a>` : 'Not provided'}
                  </td>
                </tr>
                ${ticket.assignee ? `
                <tr>
                  <td style="padding:8px 0;color:#666"><strong>Assigned To:</strong></td>
                  <td style="padding:8px 0;color:#333">${ticket.assignee}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          <!-- Request Details -->
          <tr>
            <td style="padding:0 20px 20px 20px">
              <h2 style="margin:0 0 15px 0;font-size:18px;color:#333">Request Details</h2>
              <div style="background:#f8f9fa;padding:15px;border-radius:4px;border-left:4px solid ${priorityColor}">
                <p style="margin:0;color:#333;line-height:1.6">
                  ${(ticket.summary || 'No summary provided').replace(/\n/g, '<br>')}
                </p>
              </div>
            </td>
          </tr>
          
          ${products.length > 0 ? `
          <!-- Products -->
          <tr>
            <td style="padding:0 20px 20px 20px">
              <h2 style="margin:0 0 15px 0;font-size:18px;color:#333">Products Requested</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #dee2e6">
                <thead>
                  <tr style="background:#f8f9fa">
                    <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6">Product</th>
                    <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>
            </td>
          </tr>
          ` : ''}
          
          ${ticket.aiClassification ? `
          <!-- AI Analysis -->
          <tr>
            <td style="padding:0 20px 20px 20px">
              <h2 style="margin:0 0 15px 0;font-size:18px;color:#333">AI Analysis</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;background:#f0f8ff;padding:10px;border-radius:4px">
                <tr>
                  <td style="padding:8px">
                    <strong>Classification:</strong> ${ticket.aiClassification.requestType || 'N/A'}<br>
                    <strong>Confidence:</strong> ${ticket.aiClassification.confidence || 0}%<br>
                    ${ticket.aiClassification.urgencyIndicators?.length > 0 ? 
                      `<strong>Urgency Indicators:</strong> ${ticket.aiClassification.urgencyIndicators.join(', ')}<br>` : ''}
                    ${ticket.aiSentiment ? 
                      `<strong>Sentiment:</strong> ${ticket.aiSentiment} (${ticket.aiSentimentScore || 0}/100)<br>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Additional Data -->
          ${ticket.data && Object.keys(ticket.data).length > 0 ? `
          <tr>
            <td style="padding:0 20px 20px 20px">
              <details>
                <summary style="cursor:pointer;color:#007bff;margin-bottom:10px">View Additional Data</summary>
                <pre style="background:#f8f9fa;padding:10px;border-radius:4px;overflow-x:auto;font-size:12px">
${JSON.stringify(ticket.data, null, 2)}
                </pre>
              </details>
            </td>
          </tr>
          ` : ''}
          
          <!-- Action Button -->
          <tr>
            <td style="padding:20px;background:#f8f9fa;border-top:1px solid #dee2e6">
              <table role="presentation" style="width:100%;border-collapse:collapse">
                <tr>
                  <td align="center">
                    <a href="${process.env.APP_URL}/tickets/${ticket.id}" 
                       style="display:inline-block;padding:12px 30px;background:${priorityColor};color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold">
                      Open Ticket
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:15px;background:#333;color:#ffffff;text-align:center;font-size:12px;border-radius:0 0 8px 8px">
              Alliance Chemical Customer Service<br>
              Ticket created: ${new Date(ticket.createdAt).toLocaleString('en-US', { 
                timeZone: 'America/Chicago',
                dateStyle: 'medium',
                timeStyle: 'short'
              })} CT
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Plain text version for fallback
export const ticketEmailText = (ticket: TicketEmailData): string => {
  return `
NEW TICKET #${ticket.id}
Type: ${ticket.requestType.toUpperCase()}
Priority: ${ticket.priority?.toUpperCase() || 'NORMAL'}

CUSTOMER INFORMATION
Name: ${ticket.customerName || 'Not provided'}
Email: ${ticket.customerEmail || 'Not provided'}
Phone: ${ticket.customerPhone || 'Not provided'}
Assigned To: ${ticket.assignee || 'Unassigned'}

REQUEST DETAILS
${ticket.summary || 'No summary provided'}

${ticket.data?.products?.length > 0 ? `
PRODUCTS REQUESTED
${ticket.data.products.map((p: any) => `- ${p.name}: ${p.quantity} ${p.unit || ''}`).join('\n')}
` : ''}

${ticket.aiSentiment ? `
AI ANALYSIS
Sentiment: ${ticket.aiSentiment} (${ticket.aiSentimentScore}/100)
` : ''}

View ticket: ${process.env.APP_URL}/tickets/${ticket.id}

---
Alliance Chemical Customer Service
Ticket created: ${new Date(ticket.createdAt).toLocaleString('en-US', { 
  timeZone: 'America/Chicago',
  dateStyle: 'medium',
  timeStyle: 'short'
})} CT
  `.trim();
};