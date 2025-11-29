# Package Lifecycle Flowchart - Chaski Logistics Platform

## Overview

This document provides a complete visualization of the package lifecycle in the Chaski platform, including all states, transitions, actors, and notifications.

---

## Package Status States

| Status | Description | Terminal? |
|--------|-------------|-----------|
| `NEW` | Just created, auto-transitions immediately | No |
| `OPEN_FOR_BIDS` | Accepting courier bids | No |
| `BID_SELECTED` | Sender selected a winning bid | No |
| `PENDING_PICKUP` | *Currently unused - transitions directly to IN_TRANSIT* | No |
| `IN_TRANSIT` | Courier picked up, delivering | No |
| `DELIVERED` | Successfully delivered | **Yes** |
| `CANCELED` | Sender/admin canceled | **Yes** |
| `FAILED` | Delivery attempt failed | No (admin can retry) |

---

## Main Flowchart (Mermaid)

```mermaid
flowchart TD
    subgraph Creation["CREATION"]
        A[Sender Creates Package] --> B[NEW]
        B -->|Auto-transition| C[OPEN_FOR_BIDS]
    end

    subgraph Bidding["BIDDING PHASE"]
        C -->|Couriers place bids| D{Bids Received?}
        D -->|Yes| E[Sender Reviews Bids]
        D -->|No bids after deadline| C
        E -->|Selects winning bid| F[BID_SELECTED]
        E -->|Deadline expires<br/>max 2 extensions| G{Extensions < 2?}
        G -->|Yes| H[Extend 12 hours]
        H --> E
        G -->|No| I[All bids EXPIRED]
        I --> C
    end

    subgraph Pickup["PICKUP"]
        F -->|Courier confirms pickup| J[IN_TRANSIT]
    end

    subgraph Delivery["DELIVERY"]
        J -->|Upload proof if required| K{Delivery Proof}
        K -->|Submitted| L[Mark Delivered]
        L --> M[DELIVERED]
        J -->|Delivery fails| N[FAILED]
    end

    subgraph Cancel["CANCELLATION"]
        C -->|Sender cancels| O[CANCELED]
        F -->|Sender cancels| O
    end

    subgraph Recovery["RECOVERY"]
        N -->|Admin retries| C
    end

    style M fill:#22c55e,color:#fff
    style O fill:#ef4444,color:#fff
    style N fill:#f97316,color:#fff
```

---

## Detailed State Transition Diagram

```mermaid
stateDiagram-v2
    [*] --> NEW: Sender creates package

    NEW --> OPEN_FOR_BIDS: Auto-transition
    NEW --> CANCELED: Sender cancels

    OPEN_FOR_BIDS --> BID_SELECTED: Sender selects bid
    OPEN_FOR_BIDS --> CANCELED: Sender cancels
    OPEN_FOR_BIDS --> OPEN_FOR_BIDS: Bids expire (reset)

    BID_SELECTED --> IN_TRANSIT: Courier confirms pickup
    BID_SELECTED --> OPEN_FOR_BIDS: Courier cancels/route deactivated
    BID_SELECTED --> CANCELED: Sender cancels

    IN_TRANSIT --> DELIVERED: Courier marks delivered
    IN_TRANSIT --> FAILED: Admin marks failed
    IN_TRANSIT --> CANCELED: Admin cancels

    FAILED --> OPEN_FOR_BIDS: Admin retries
    FAILED --> CANCELED: Admin cancels

    DELIVERED --> [*]
    CANCELED --> [*]
```

---

## Bidding Lifecycle Detail

```mermaid
flowchart LR
    subgraph BidStates["Bid Statuses"]
        BP[PENDING] -->|Sender selects| BS[SELECTED]
        BP -->|Other bid selected| BR[REJECTED]
        BP -->|Courier withdraws| BW[WITHDRAWN]
        BP -->|Deadline expires| BE[EXPIRED]
    end

    subgraph Timeline["Bid Timeline"]
        T1[First Bid] -->|24 hours| T2{Deadline}
        T2 -->|No selection| T3{Extensions < 2?}
        T3 -->|Yes| T4[+12 hours]
        T4 --> T2
        T3 -->|No| T5[All Bids Expire]
        T2 -->|6 hours before| T6[Warning Notification]
    end
```

---

## Actor Responsibilities

```mermaid
flowchart TB
    subgraph Sender["SENDER Actions"]
        S1[Create Package]
        S2[Review Bids]
        S3[Select Winning Bid]
        S4[Cancel Package]
        S5[Rate Delivery]
    end

    subgraph Courier["COURIER Actions"]
        C1[View Matching Packages]
        C2[Place Bid]
        C3[Withdraw Bid]
        C4[Confirm Pickup]
        C5[Update Location]
        C6[Upload Delivery Proof]
        C7[Mark Delivered]
        C8[Mark Failed]
    end

    subgraph Admin["ADMIN Actions"]
        A1[View All Packages]
        A2[Cancel Any Package]
        A3[Retry Failed Delivery]
        A4[View Audit Logs]
    end

    subgraph System["SYSTEM Jobs"]
        J1[Bid Deadline Monitor]
        J2[Route Cleanup]
        J3[Package-Route Matching]
    end
```

---

## Notifications by Stage

| Stage | Recipient | Notification Type | Message |
|-------|-----------|-------------------|---------|
| **Bid Placed** | Sender | `NEW_BID_RECEIVED` | "New bid of $X from Courier" |
| **Bid Placed** | Courier | `BID_PLACED` | "Your bid was placed" |
| **Bid Withdrawn** | Sender | `BID_WITHDRAWN` | "Courier withdrew bid" |
| **6hr Warning** | Sender | `BID_DEADLINE_WARNING` | "Select a bid within 6 hours" |
| **Extended** | Sender | `BID_DEADLINE_EXTENDED` | "Deadline extended 12 hours" |
| **Expired** | All | `BID_DEADLINE_EXPIRED` | "Bidding period ended" |
| **Bid Selected** | Winner | `BID_SELECTED` | "Your bid was selected!" |
| **Bid Selected** | Others | `BID_REJECTED` | "Another courier selected" |
| **Pickup** | Sender | `PACKAGE_ACCEPTED` | "Package picked up, in transit" |
| **Delivered** | Sender | `PACKAGE_DELIVERED` | "Package delivered!" |
| **Canceled** | Courier | `PACKAGE_CANCELLED` | "Package was cancelled" |
| **Failed** | Sender | `DELIVERY_FAILED` | "Delivery failed, contact support" |

---

## Valid State Transitions Matrix

| From State | To States |
|------------|-----------|
| `NEW` | `OPEN_FOR_BIDS`, `CANCELED` |
| `OPEN_FOR_BIDS` | `BID_SELECTED`, `CANCELED` |
| `BID_SELECTED` | `PENDING_PICKUP`, `OPEN_FOR_BIDS`, `CANCELED` |
| `PENDING_PICKUP` | `IN_TRANSIT`, `CANCELED` |
| `IN_TRANSIT` | `DELIVERED`, `FAILED` *(admin only)*, `CANCELED` *(admin only)* |
| `DELIVERED` | *(terminal - none)* |
| `CANCELED` | *(terminal - none)* |
| `FAILED` | `OPEN_FOR_BIDS` *(admin only)*, `CANCELED` *(admin only)* |

---

## Timestamps Tracked

| Field | Set When |
|-------|----------|
| `created_at` | Package created |
| `updated_at` | Any field updated |
| `status_changed_at` | Status changes |
| `bid_deadline` | First bid placed (+24h) |
| `bid_selected_at` | Bid selected |
| `pending_pickup_at` | PENDING_PICKUP status |
| `in_transit_at` | IN_TRANSIT status |
| `delivery_time` | DELIVERED status |
| `failed_at` | FAILED status |

---

## Happy Path Summary

```
1. Sender creates package
   |
   v
2. Package OPEN_FOR_BIDS (couriers bid for 24-48h)
   |
   v
3. Sender selects winning bid --> BID_SELECTED
   |
   v
4. Courier confirms pickup --> IN_TRANSIT
   |
   v
5. Courier uploads delivery proof (if required)
   |
   v
6. Courier marks delivered --> DELIVERED
   |
   v
7. Payment released, ratings enabled
```

---

## Edge Cases

1. **No bids received**: Package stays in OPEN_FOR_BIDS indefinitely
2. **Sender doesn't select bid**: Auto-extends twice, then all bids expire and reset
3. **Courier cancels after selection**: Package returns to OPEN_FOR_BIDS
4. **Route expires**: Courier's bids auto-withdrawn
5. **Delivery fails**: Admin can retry, resets to OPEN_FOR_BIDS
6. **Package requires proof**: Cannot mark delivered without uploading proof

---

## Key Source Files

| File | Purpose |
|------|---------|
| `app/models/package.py` | Package model, PackageStatus enum |
| `app/services/package_status.py` | State transition validation |
| `app/routes/packages.py` | Package CRUD, status updates |
| `app/routes/bids.py` | Bidding system |
| `app/services/bid_deadline_job.py` | Deadline management |
| `app/services/route_deactivation_service.py` | Route cleanup |
| `app/routes/delivery_proof.py` | Proof upload |
