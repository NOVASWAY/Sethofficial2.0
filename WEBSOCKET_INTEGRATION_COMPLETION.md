# 🌐 WebSocket Integration - Completion Summary

**Date**: January 2025  
**Status**: ✅ Infrastructure Complete | ⏳ Handler Integration In Progress

---

## Overview

WebSocket infrastructure has been fully integrated into the backend for real-time updates. The system now supports:
- ✅ WebSocket server with actor-based architecture
- ✅ JWT authentication for WebSocket connections
- ✅ Broadcast and direct messaging
- ✅ Helper functions for real-time updates
- ✅ Integration points ready for handlers

---

## Implementation Details

### 1. WebSocket Route

**Endpoint**: `GET /api/ws`

**Authentication**: 
- JWT token required
- Can be provided via:
  - Query parameter: `?token=YOUR_JWT_TOKEN`
  - Authorization header: `Authorization: Bearer YOUR_JWT_TOKEN`

**Connection Example:**
```javascript
const token = localStorage.getItem('auth_token');
const ws = new WebSocket(`ws://localhost:8080/api/ws?token=${token}`);
```

### 2. WebSocket Architecture

**Actors:**
- `WebSocketManager` - Manages all connected sessions
- `WebSocketSession` - Individual client connection

**Message Types:**
- `Connect` - New client connection
- `Disconnect` - Client disconnection
- `BroadcastMessage` - Send to all connected clients
- `DirectMessage` - Send to specific client
- `ClientMessage` - Receive from client

### 3. Message Format

**WebSocket Message Structure:**
```json
{
  "message_type": "appointment_update",
  "data": {
    "appointment": {...},
    "update_type": "created",
    "timestamp": "2025-01-20T10:00:00Z"
  },
  "timestamp": 1705752000
}
```

### 4. Available Message Types

The system supports the following message types:
- `appointment_update` - Appointment changes
- `patient_update` - Patient record changes
- `queue_update` - Queue position updates
- `stock_alert` - Low stock alerts
- `expiry_alert` - Medicine expiry alerts
- `billing_update` - Invoice/payment updates
- `prescription_update` - Prescription changes
- `system_notification` - General system notifications
- `user_notification` - User-specific notifications

---

## Helper Functions

### Broadcast Functions (Already Implemented)

Located in `backend/src/websocket.rs`:

1. **`broadcast_appointment_update()`**
   ```rust
   websocket::broadcast_appointment_update(
       websocket_manager.clone(),
       appointment,
       "created" // or "updated", "cancelled"
   ).await?;
   ```

2. **`broadcast_patient_update()`**
   ```rust
   websocket::broadcast_patient_update(
       websocket_manager.clone(),
       patient,
       "created" // or "updated", "deleted"
   ).await?;
   ```

3. **`broadcast_queue_update()`**
   ```rust
   websocket::broadcast_queue_update(
       websocket_manager.clone(),
       queue_items,
       current_patient_id
   ).await?;
   ```

4. **`broadcast_stock_alert()`**
   ```rust
   websocket::broadcast_stock_alert(
       websocket_manager.clone(),
       stock_alert
   ).await?;
   ```

5. **`broadcast_expiry_alert()`**
   ```rust
   websocket::broadcast_expiry_alert(
       websocket_manager.clone(),
       expiry_alert
   ).await?;
   ```

6. **`broadcast_billing_update()`**
   ```rust
   websocket::broadcast_billing_update(
       websocket_manager.clone(),
       invoice,
       "paid" // or "created", "updated", "cancelled"
   ).await?;
   ```

7. **`broadcast_prescription_update()`**
   ```rust
   websocket::broadcast_prescription_update(
       websocket_manager.clone(),
       prescription,
       "dispensed" // or "created", "updated"
   ).await?;
   ```

8. **`broadcast_system_notification()`**
   ```rust
   websocket::broadcast_system_notification(
       websocket_manager.clone(),
       "Title",
       "Message",
       "info", // or "warning", "error", "success"
       "normal" // or "high", "urgent"
   ).await?;
   ```

---

## Integration with Handlers

### Accessing WebSocket Manager in Handlers

The WebSocket manager is available via `web::Data<Addr<WebSocketManager>>` in handlers.

**Example Integration in Handler:**
```rust
pub async fn create_appointment(
    req: web::Json<CreateAppointmentRequest>,
    state: web::Data<AppState>,
    ws_manager: web::Data<actix::Addr<websocket::WebSocketManager>>,
) -> Result<HttpResponse> {
    // ... create appointment ...
    
    // Broadcast update
    if let Ok(appointment) = created_appointment {
        let _ = websocket::broadcast_appointment_update(
            ws_manager.get_ref().clone(),
            appointment,
            "created"
        ).await;
    }
    
    Ok(HttpResponse::Ok().json(response))
}
```

### Adding to AppState (Alternative)

Alternatively, you can add WebSocket manager to AppState:

```rust
pub struct AppState {
    pub db_pool: PgPool,
    pub auth_service: auth::AuthService,
    pub websocket_manager: actix::Addr<websocket::WebSocketManager>,
}
```

Then access it via `state.websocket_manager` in handlers.

---

## Frontend Integration

### WebSocket Client Example

```typescript
// lib/websocket-client.ts
let ws: WebSocket | null = null;

export function connectWebSocket(onMessage: (data: any) => void) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('No auth token available');
    return;
  }

  const wsUrl = `ws://${process.env.NEXT_PUBLIC_API_URL?.replace('http://', '').replace('https://', '')}/api/ws?token=${token}`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      onMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Optionally implement reconnection logic
    setTimeout(() => connectWebSocket(onMessage), 5000);
  };
}

export function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}
```

### React Hook Example

```typescript
// hooks/useWebSocket.ts
import { useEffect, useState } from 'react';
import { connectWebSocket, disconnectWebSocket } from '@/lib/websocket-client';

export function useWebSocket() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleMessage = (message: any) => {
      setMessages((prev) => [...prev, message]);
      
      // Handle different message types
      switch (message.message_type) {
        case 'appointment_update':
          // Update appointments list
          break;
        case 'patient_update':
          // Update patients list
          break;
        case 'queue_update':
          // Update queue display
          break;
        case 'stock_alert':
          // Show stock alert notification
          break;
        default:
          console.log('Unknown message type:', message.message_type);
      }
    };

    connectWebSocket(handleMessage);
    setIsConnected(true);

    return () => {
      disconnectWebSocket();
      setIsConnected(false);
    };
  }, []);

  return { messages, isConnected };
}
```

---

## Integration Points

### Where to Add WebSocket Broadcasts

1. **Appointment Handlers** (`simple_handlers.rs`):
   - `create_appointment()` - Broadcast on creation
   - `update_appointment()` - Broadcast on update
   - `delete_appointment()` - Broadcast on deletion

2. **Patient Handlers**:
   - `create_patient()` - Broadcast new patient
   - `update_patient()` - Broadcast patient updates

3. **Inventory Handlers**:
   - `receive_stock()` - Broadcast stock updates
   - `adjust_stock()` - Broadcast stock adjustments
   - `get_low_stock()` - Broadcast when stock goes low

4. **Prescription Handlers**:
   - `dispense_prescription()` - Broadcast dispensing
   - `create_prescription()` - Broadcast new prescription

5. **Invoice Handlers**:
   - `pay_invoice()` - Broadcast payment updates
   - `create_invoice()` - Broadcast new invoices

6. **Appointment Queue**:
   - Update queue position
   - Current patient changes

---

## Testing

### Test WebSocket Connection

**Using wscat:**
```bash
npm install -g wscat

# Connect with token
wscat -c "ws://localhost:8080/api/ws?token=YOUR_JWT_TOKEN"
```

**Using curl:**
```bash
curl -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/ws
```

### Test Message Format

Send message from client:
```json
{
  "message_type": "ping",
  "data": {},
  "timestamp": 1705752000
}
```

Receive broadcast:
```json
{
  "message_type": "appointment_update",
  "data": {
    "appointment": {
      "id": "uuid",
      "patient_id": "uuid",
      "date": "2025-01-20",
      "time": "10:00:00"
    },
    "update_type": "created",
    "timestamp": "2025-01-20T10:00:00Z"
  },
  "timestamp": 1705752000
}
```

---

## Security Considerations

1. ✅ **JWT Authentication**: All connections require valid JWT token
2. ✅ **Token Validation**: Tokens verified before connection
3. ✅ **Session Management**: Sessions tracked and cleaned on disconnect
4. ⏳ **Rate Limiting**: Consider adding rate limiting for WebSocket messages
5. ⏳ **Message Size Limits**: Enforce maximum message size

---

## Performance Considerations

1. **Connection Limits**: Monitor number of concurrent connections
2. **Message Batching**: Batch multiple updates when possible
3. **Selective Broadcasting**: Only send to relevant clients when possible
4. **Connection Pooling**: Reuse WebSocket connections when appropriate

---

## Files Modified/Created

1. ✅ `backend/src/main.rs` - Added WebSocket route and manager initialization
2. ✅ `backend/src/websocket.rs` - Enhanced with JWT authentication
3. ✅ WebSocket infrastructure already existed

---

## Next Steps

1. **Integrate Broadcasts in Handlers**:
   - Add WebSocket broadcasts to appointment handlers
   - Add broadcasts to patient handlers
   - Add broadcasts to inventory handlers
   - Add broadcasts to prescription handlers
   - Add broadcasts to invoice handlers

2. **Frontend Implementation**:
   - Create WebSocket client utility
   - Create React hooks for WebSocket
   - Integrate with existing components
   - Add real-time UI updates

3. **Testing**:
   - Test WebSocket connection
   - Test message broadcasting
   - Test reconnection logic
   - Load testing for concurrent connections

4. **Monitoring**:
   - Track connection count
   - Monitor message throughput
   - Track disconnection rates
   - Alert on errors

---

## Example: Adding Broadcast to Appointment Handler

```rust
// In simple_handlers.rs
pub async fn create_appointment(
    req: web::Json<CreateAppointmentRequest>,
    state: web::Data<AppState>,
    ws_manager: web::Data<actix::Addr<websocket::WebSocketManager>>,
) -> Result<HttpResponse> {
    // ... existing appointment creation logic ...
    
    // After successfully creating appointment:
    if let Ok(appointment) = created_appointment {
        // Broadcast to all connected clients
        let _ = websocket::broadcast_appointment_update(
            ws_manager.get_ref().clone(),
            appointment,
            "created"
        ).await;
    }
    
    Ok(HttpResponse::Ok().json(response))
}
```

**Note**: Make sure to add `ws_manager` parameter to handler signature and route registration.

---

**Status**: ✅ **WebSocket infrastructure is complete!** Ready for handler integration and frontend implementation.
