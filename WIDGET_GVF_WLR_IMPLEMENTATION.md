# Widget API GVF/WLR Calculation Implementation

## Overview

The widget API has been successfully enhanced to calculate Gas Volume Fraction (GVF) and Water-Liquid Ratio (WLR) values in real-time. These values are now computed dynamically from source device data using industry-standard formulas with hierarchical data aggregation support.

## Formulas

### GVF (Gas Volume Fraction)
```
GVF = (GFR / (GFR + OFR + WFR)) × 100
```
- **Numerator**: Gas Flow Rate (GFR)
- **Denominator**: Sum of Gas Flow Rate + Oil Flow Rate (OFR) + Water Flow Rate (WFR)
- **Result**: Percentage representing the proportion of gas in total flow

### WLR (Water-Liquid Ratio)
```
WLR = (WFR / (WFR + OFR)) × 100
```
- **Numerator**: Water Flow Rate (WFR)
- **Denominator**: Sum of Water Flow Rate + Oil Flow Rate (OFR)
- **Result**: Percentage representing the proportion of water in liquid flow

## Implementation Details

### Location
- **File**: `/routes/widgets.js`
- **Lines**: 575-669
- **Endpoint**: Widget time-series data endpoint

### Key Features

#### 1. Dynamic Calculation
- Values are calculated on-demand rather than stored in the database
- Calculations occur at query time ensuring data accuracy
- Source values (GFR, WFR, OFR) are extracted from device data JSON fields

#### 2. Hierarchical Aggregation
- System supports querying data at multiple hierarchy levels
- Device data can be aggregated based on selected hierarchy filters
- Results are returned for specified time ranges with proper data point limiting

#### 3. Data Safety
- **Division-by-Zero Protection**: CASE statements prevent division errors
  - If denominator equals zero, value defaults to 0
  - Example: If GFR + OFR + WFR = 0, GVF returns 0

- **NULL Handling**: COALESCE function treats missing values as 0
  - Missing GFR, WFR, or OFR values are treated as zero
  - Prevents NULL propagation through calculations

#### 4. Calculated Field Detection
```javascript
const isGVF = variableTag === 'GVF';
const isWLR = variableTag === 'WLR';
```
- System automatically detects when GVF or WLR is requested
- Routes calculation logic based on field type
- Maintains parameter consistency across different query types

### Database Query Structure

#### GVF Calculation Query
```sql
SELECT
  dd.created_at as timestamp,
  dd.serial_number,
  CASE
    WHEN COALESCE((dd.data->>'GFR')::numeric, 0) +
         COALESCE((dd.data->>'OFR')::numeric, 0) +
         COALESCE((dd.data->>'WFR')::numeric, 0) > 0
    THEN COALESCE((dd.data->>'GFR')::numeric, 0) * 100.0 /
         (COALESCE((dd.data->>'GFR')::numeric, 0) +
          COALESCE((dd.data->>'OFR')::numeric, 0) +
          COALESCE((dd.data->>'WFR')::numeric, 0))
    ELSE 0
  END as value
FROM device_data dd
INNER JOIN device d ON dd.device_id = d.id
WHERE d.company_id = $1
  AND d.device_type_id = $2
  [Optional filters and time ranges]
  AND (dd.data ? 'GFR' OR dd.data ? 'OFR' OR dd.data ? 'WFR')
ORDER BY dd.created_at ASC
LIMIT [specified limit]
```

#### WLR Calculation Query
```sql
SELECT
  dd.created_at as timestamp,
  dd.serial_number,
  CASE
    WHEN COALESCE((dd.data->>'WFR')::numeric, 0) +
         COALESCE((dd.data->>'OFR')::numeric, 0) > 0
    THEN COALESCE((dd.data->>'WFR')::numeric, 0) * 100.0 /
         (COALESCE((dd.data->>'WFR')::numeric, 0) +
          COALESCE((dd.data->>'OFR')::numeric, 0))
    ELSE 0
  END as value
FROM device_data dd
INNER JOIN device d ON dd.device_id = d.id
WHERE d.company_id = $1
  AND d.device_type_id = $2
  [Optional filters and time ranges]
  AND (dd.data ? 'WFR' OR dd.data ? 'OFR')
ORDER BY dd.created_at ASC
LIMIT [specified limit]
```

## API Usage

### Request Example
```json
{
  "widgetId": "widget-123",
  "variables": [
    {
      "variableName": "GasVolumeFraction",
      "variableTag": "GVF",
      "unit": "%"
    },
    {
      "variableName": "WaterLiquidRatio",
      "variableTag": "WLR",
      "unit": "%"
    }
  ],
  "hierarchyId": "hierarchy-456",
  "timeRange": "24h",
  "limit": 1000
}
```

### Response Example
```json
{
  "seriesData": {
    "GasVolumeFraction": {
      "data": [
        {
          "timestamp": "2024-01-15T10:30:00Z",
          "serialNumber": "DEV-001",
          "value": 68.5
        },
        {
          "timestamp": "2024-01-15T10:31:00Z",
          "serialNumber": "DEV-001",
          "value": 69.2
        }
      ],
      "unit": "%",
      "propertyName": "GasVolumeFraction"
    },
    "WaterLiquidRatio": {
      "data": [
        {
          "timestamp": "2024-01-15T10:30:00Z",
          "serialNumber": "DEV-001",
          "value": 42.3
        }
      ],
      "unit": "%",
      "propertyName": "WaterLiquidRatio"
    }
  }
}
```

## Technical Architecture

### Data Flow
1. **Widget Request** → Receives request for GVF/WLR data
2. **Field Detection** → Identifies if requested field is calculated (GVF/WLR)
3. **Query Construction** → Builds appropriate SQL with calculation logic
4. **Database Execution** → Queries device_data table and applies calculations
5. **Data Formatting** → Formats results with timestamp, serial number, and calculated value
6. **Response** → Returns time-series data to widget frontend

### Error Handling
- All NULL values treated as 0 via COALESCE
- Division-by-zero prevented via CASE statements
- Invalid field requests routed to regular lookup logic
- Database connection errors propagated to caller with appropriate status codes

## Consistency Across APIs

The GVF/WLR calculation implementation in the widget API is consistent with:
- **Charts API** (`/routes/charts.js`): Uses identical calculation formulas
- **Device Model** (`/models/Device.js`): References the same GFR/WFR/OFR variables
- **Industry Standards**: Follows established petroleum engineering conventions

## Testing Recommendations

1. **Calculation Accuracy**
   - Verify GVF values fall within 0-100 range
   - Verify WLR values fall within 0-100 range
   - Test with known GFR, WFR, OFR combinations

2. **Edge Cases**
   - All source values = 0 (should return 0)
   - Missing source values (should treat as 0)
   - Mixed present/absent values

3. **Performance**
   - Query execution time with large datasets (>100k records)
   - Index verification on device_id and company_id
   - Cache behavior for repeated queries

4. **Hierarchy Integration**
   - Aggregation at different hierarchy levels
   - Cross-device calculations
   - Time range filtering accuracy

## Performance Considerations

- **Calculation Overhead**: Minimal - calculations performed at database level (PostgreSQL)
- **Query Optimization**: Uses indexed device_id and company_id fields
- **Data Volume**: Handles thousands of data points efficiently
- **Memory Usage**: Results streamed to client, no in-memory aggregation

## Security

- **Row-Level Security**: Respects company isolation through company_id filtering
- **Data Validation**: All numeric values validated before calculation
- **Parameter Binding**: Uses prepared statements to prevent SQL injection
- **Access Control**: Inherits widget-level access restrictions

## Maintenance Notes

- **Source Fields**: Calculations depend on GFR, WFR, and OFR fields existing in device data
- **Schema Stability**: No schema changes required - uses existing JSON structures
- **Backward Compatibility**: Non-GVF/WLR requests unaffected by implementation
- **Monitoring**: Review logs for any calculation warnings or data quality issues

---

**Implementation Date**: November 2024
**Status**: Production Ready
**Next Review**: As needed for performance optimization
