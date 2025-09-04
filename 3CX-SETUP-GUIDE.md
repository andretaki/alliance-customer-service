# 3CX Integration Setup Guide

## Prerequisites
- 3CX Phone System v18 or higher
- Admin access to 3CX Management Console
- Public URL for your Alliance Customer Service (for webhooks)

## Step 1: Access 3CX Management Console

1. Open your browser and navigate to: `https://your-3cx-server:5001`
2. Login with your admin credentials

## Step 2: Configure CRM Integration

### Navigate to CRM Integration
1. Go to **Settings** → **Integrations** → **CRM Integration**
2. Click **Add** to create a new CRM template

### Configure Template Settings
1. **Template Name**: `Alliance Customer Service`
2. **CRM Type**: Select `Generic CRM`
3. **Enable for**: Check all extensions that should use this integration

## Step 3: Set Up Webhook URL

### Configure Call Events
1. In the CRM template, go to **Call Events** tab
2. Enable the following events:
   - ✅ **Call Started**
   - ✅ **Call Ringing**
   - ✅ **Call Connected**
   - ✅ **Call Ended**
   - ✅ **Call Transferred**

### Set Webhook Endpoint
1. **Webhook URL**: `https://your-domain.com/api/calls/webhook`
   - For local testing: Use ngrok or similar tunnel service
   - For production: Use your deployed URL
2. **Method**: `POST`
3. **Content Type**: `application/json`

## Step 4: Configure Security

### Generate HMAC Secret
1. Go to **Security Settings** in the CRM template
2. Click **Generate Secret** to create a new HMAC secret
3. Copy the generated secret (you'll need this for .env.local)
4. Enable **Sign Webhooks** checkbox
5. **Header Name**: `x-3cx-signature`

## Step 5: Set Up Call Recording Access

### Find Recording URL
1. Go to **System** → **Recordings**
2. Note the **Web Meeting URL** (usually `https://your-3cx-server.com`)
3. Go to **HTTP API** settings
4. Ensure **Allow Recording Download** is enabled

### Configure Recording Permissions
1. Go to **Security** → **API Keys**
2. Create new API key for recording access if needed
3. Set appropriate permissions for recording retrieval

## Step 6: Configure Call Popup (Screen Pop)

### Enable Screen Pop
1. In CRM template, go to **Screen Pop** tab
2. **Popup URL**: `https://your-domain.com/api/calls/lookup/{CallID}`
3. **Popup Trigger**: Select `On Ringing`
4. **Window Settings**:
   - Width: 400
   - Height: 600
   - Position: Top Right

## Step 7: Field Mapping

Configure which 3CX fields map to your webhook payload:

| 3CX Field | Webhook Field | Description |
|-----------|---------------|-------------|
| Call.ID | CallID | Unique call identifier |
| Call.Direction | Direction | Inbound/Outbound |
| Call.CallerNumber | From | Calling number |
| Call.CalledNumber | To | Called number |
| Call.Agent.Extension | Agent.Extension | Agent's extension |
| Call.Agent.Name | Agent.Name | Agent's name |
| Call.StartTime | StartTime | Call start timestamp |
| Call.EndTime | EndTime | Call end timestamp |
| Call.Recording | RecordingFile | Recording filename |
| Call.Queue | Queue | Queue name if applicable |
| Call.Tags | Tags | Call tags array |

## Step 8: Update Environment Variables

Add to your `.env.local` file:

```bash
# Replace with your actual values from 3CX setup
THREE_CX_WEBHOOK_SECRET="your-generated-hmac-secret"
THREE_CX_RECORDING_BASE_URL="https://your-3cx-server.com/recordings"
```

## Step 9: Test the Integration

### Test Webhook
1. Make a test call to your 3CX system
2. Check your application logs for webhook receipt
3. Verify call appears in database

### Test with cURL
```bash
# Test webhook endpoint
curl -X POST http://localhost:3002/api/calls/webhook \
  -H "Content-Type: application/json" \
  -H "x-3cx-signature: test-signature" \
  -d '{
    "CallID": "test-123",
    "Direction": "Inbound",
    "From": "+1234567890",
    "To": "+0987654321",
    "Agent": {
      "Extension": "101",
      "Name": "Test Agent"
    },
    "StartTime": "2024-01-01T10:00:00Z",
    "Queue": "support",
    "Tags": ["test"]
  }'
```

### Test Screen Pop
```bash
# Test lookup endpoint
curl http://localhost:3002/api/calls/lookup/test-123
```

## Step 10: Production Deployment

### Before Going Live
1. ✅ Test all webhook events
2. ✅ Verify HMAC signature validation
3. ✅ Test screen pop functionality
4. ✅ Ensure recording URLs are accessible
5. ✅ Set up monitoring for webhook failures

### Monitor Integration
- Check `calls` table for incoming calls
- Review `tickets` table for auto-created tickets
- Monitor webhook response times
- Set up alerts for failed webhooks

## Troubleshooting

### Webhook Not Receiving Calls
1. Check firewall rules for port 3002
2. Verify webhook URL is publicly accessible
3. Check 3CX logs: **System** → **Event Log**
4. Ensure HMAC secret matches in both systems

### Recording URLs Not Working
1. Verify recording base URL format
2. Check 3CX recording permissions
3. Ensure recordings are set to be retained
4. Test recording URL directly in browser

### Screen Pop Not Appearing
1. Check browser popup blocker settings
2. Verify popup URL is correct
3. Test with different browsers
4. Check agent's CRM integration is enabled

## Support Resources

- **3CX Documentation**: https://www.3cx.com/docs/manual/crm-integration/
- **3CX API Reference**: https://www.3cx.com/docs/api/
- **Alliance Customer Service Logs**: Check application logs for detailed error messages