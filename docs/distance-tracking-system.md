# Distance Tracking System

The Distance Tracking System is a comprehensive solution for monitoring and analyzing field employee travel patterns, calculating distances between check-in points, and detecting movement anomalies.

## Features

### 1. Automatic Distance Calculation
- **Haversine Formula**: Direct distance calculation between GPS coordinates
- **Google Distance Matrix API**: Route-based distance and duration calculation
- **Fallback Mechanism**: Automatically falls back to Haversine if Google API fails
- **Real-time Tracking**: Calculates distance from previous check-in point

### 2. Daily Distance Accumulation
- **Daily Records**: Aggregates all check-in points for each day
- **Total Distance**: Cumulative distance traveled per day
- **Total Duration**: Total travel time (when using Google API)
- **Check-in Count**: Number of location points recorded

### 3. Anomaly Detection
- **Excessive Speed**: Detects unrealistic travel speeds (default: >120 km/h)
- **Impossible Distance**: Identifies physically impossible movements
- **Location Jumps**: Flags large distance changes in short time periods
- **Daily Limits**: Monitors total daily distance (default: >500 km/day)

### 4. Validation and Compliance
- **Automatic Validation**: Daily records marked as validated/invalid based on anomalies
- **Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL anomaly classifications
- **Manual Recalculation**: Admin ability to recalculate distances using latest API data
- **Audit Trail**: Complete history of all distance calculations and anomalies

## API Endpoints

### Track Distance
```http
POST /api/distance-tracking
Content-Type: application/json

{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  },
  "siteId": "site_123",
  "siteName": "Client Office"
}
```

### Get Distance Records
```http
GET /api/distance-tracking?startDate=2024-01-01&endDate=2024-01-31&employeeId=emp_123
```

### Get Daily Record
```http
GET /api/distance-tracking/2024-01-15?employeeId=emp_123
```

### Recalculate Distances
```http
POST /api/distance-tracking/2024-01-15
Content-Type: application/json

{
  "employeeId": "emp_123"
}
```

### Get Statistics
```http
GET /api/distance-tracking/statistics?startDate=2024-01-01&endDate=2024-01-31&employeeId=emp_123
```

## Database Models

### DistanceTrackingPoint
Stores individual check-in points with location and distance data:
- GPS coordinates (latitude, longitude, accuracy)
- Distance and duration from previous point
- Calculation method (HAVERSINE or GOOGLE_MATRIX)
- Associated site information

### DailyDistanceRecord
Aggregated daily distance information:
- Total distance and duration for the day
- Number of check-in points
- Validation status (based on anomaly detection)

### DistanceAnomaly
Records detected movement anomalies:
- Anomaly type and severity
- Description of the issue
- Associated check-in point
- Resolution status and notes

### DistanceCalculationConfig
System configuration for distance tracking:
- Maximum speed limits
- Daily distance limits
- Anomaly detection settings
- Google Maps API configuration

## Configuration

### Environment Variables
```bash
# Google Maps API Key (optional)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Default Configuration
```typescript
{
  maxSpeedKmh: 120,           // Maximum reasonable speed
  maxDistancePerDayKm: 500,   // Maximum daily distance
  minTimeBetweenCheckins: 5,  // Minimum minutes between check-ins
  enableGoogleMatrixAPI: true,
  anomalyDetectionEnabled: true
}
```

## Integration Points

### Site Visit Integration
- Automatically tracks distance when field employees check into sites
- Associates distance data with site visit records
- Provides travel context for site visits

### Attendance System Integration
- Integrates with GPS-based attendance tracking
- Adds distance tracking to regular check-in/check-out flows
- Displays daily distance summary in attendance dashboard

### Expense Management Integration
- Provides distance data for fuel expense calculations
- Supports automated mileage-based reimbursements
- Links travel distances to expense claims

## User Interface Components

### DistanceTrackingDashboard
Main dashboard for viewing and managing distance records:
- Overview statistics and charts
- Daily record listing with anomaly indicators
- Detailed record view with check-in points
- Anomaly management and resolution

### DailyDistanceDisplay
Compact widget showing today's travel summary:
- Total distance and duration
- Number of check-in points
- Anomaly alerts

## Anomaly Types and Detection

### Excessive Speed
- **Trigger**: Speed > 120 km/h (configurable)
- **Severity**: MEDIUM (120-180 km/h), HIGH (>180 km/h)
- **Description**: Calculated speed between consecutive points exceeds reasonable limits

### Impossible Distance
- **Trigger**: Distance > 2x maximum possible at max speed
- **Severity**: HIGH
- **Description**: Distance physically impossible given time difference

### Location Jump
- **Trigger**: >50km in <30 minutes
- **Severity**: MEDIUM
- **Description**: Large distance change in short time period

### Daily Limit Exceeded
- **Trigger**: Total daily distance > 500km (configurable)
- **Severity**: HIGH
- **Description**: Total daily travel exceeds reasonable limits

## Best Practices

### For Administrators
1. **Regular Monitoring**: Review anomaly reports weekly
2. **Configuration Tuning**: Adjust limits based on business needs
3. **API Key Management**: Secure Google Maps API key properly
4. **Data Retention**: Archive old distance records as needed

### For Field Employees
1. **Accurate Check-ins**: Ensure GPS is enabled and accurate
2. **Regular Updates**: Check in at each location visited
3. **Anomaly Resolution**: Report any flagged anomalies to management

### For Developers
1. **Error Handling**: Always handle API failures gracefully
2. **Performance**: Use database indexes for date-based queries
3. **Privacy**: Respect location data privacy requirements
4. **Testing**: Test with various GPS accuracy scenarios

## Troubleshooting

### Common Issues

#### Google API Failures
- **Symptom**: All distances calculated using Haversine
- **Solution**: Check API key validity and quota limits
- **Fallback**: System continues with direct distance calculation

#### Excessive Anomalies
- **Symptom**: Many false positive anomalies
- **Solution**: Adjust configuration limits for your use case
- **Investigation**: Review GPS accuracy and check-in patterns

#### Missing Distance Data
- **Symptom**: Zero distances recorded
- **Solution**: Verify GPS permissions and location accuracy
- **Check**: Ensure distance tracking API is being called

### Performance Optimization

#### Database Queries
- Use date-based indexes for efficient record retrieval
- Implement pagination for large datasets
- Archive old records to maintain performance

#### API Usage
- Cache Google Maps API responses when possible
- Implement rate limiting to avoid quota exhaustion
- Use batch processing for historical recalculations

## Security Considerations

### Location Data Privacy
- Store only necessary location data
- Implement data retention policies
- Provide employee consent mechanisms
- Secure API endpoints with proper authentication

### API Key Security
- Store Google Maps API key securely
- Restrict API key to specific domains/IPs
- Monitor API usage for unusual patterns
- Rotate keys regularly

## Future Enhancements

### Planned Features
1. **Route Visualization**: Map display of travel routes
2. **Predictive Analytics**: ML-based anomaly detection
3. **Integration APIs**: Third-party fleet management systems
4. **Mobile Optimization**: Enhanced mobile app features
5. **Reporting**: Advanced analytics and reporting tools

### Potential Integrations
- Fleet management systems
- Fuel card providers
- Mapping and navigation apps
- Business intelligence tools
- Compliance reporting systems