# Analytics Tracking Implementation Plan

## Overview

This document outlines the comprehensive analytics tracking implementation for the Auto LinkedIn Comment AI Chrome Extension. The tracking system uses PostHog to capture user interactions, feature usage, and performance metrics to help improve the extension.

## Tracked Events

### Authentication Events
- `Login_Attempt`: When a user attempts to log in
- `Login_Success`: When a user successfully logs in
- `Login_Failure`: When a login attempt fails
- `Registration_Attempt`: When a user attempts to register
- `Registration_Success`: When a user successfully registers
- `Registration_Failure`: When a registration attempt fails
- `Beta_Access_Attempt`: When a user's email is checked for beta access
- `Sign_Out_Success`: When a user successfully signs out
- `Sign_Out_Failure`: When a sign out attempt fails
- `User_Login`: When a user logs in (with email and user ID)
- `User_Registration_Complete`: When a user completes registration (with email)

### UI Interaction Events
- `Button_Click`: When a user clicks a button (with button name)
- `Tab_Change`: When a user switches between tabs
- `Settings_Change_Attempt`: When a user attempts to save settings
- `Settings_Change_Success`: When settings are successfully saved
- `Settings_Change_Failure`: When settings save fails

### LinkedIn Interaction Events
- `AI_Button_Click`: When a user clicks any AI button (immediate tracking)
- `Profile_Visit`: When a user visits a LinkedIn profile
- `Generate_Comment`: When a user initiates comment generation
- `Generate_Comment_Success`: When a comment is successfully generated
- `Generate_Comment_Failure`: When comment generation fails
- `Generate_Connection_Message`: When a user initiates connection message generation
- `Generate_Connection_Message_Success`: When a connection message is successfully generated
- `Generate_Connection_Message_Failure`: When connection message generation fails
- `Reaction_Click`: When the extension clicks a reaction on a post

### API Events
- `API_Call`: When an API call is initiated
- `API_Call_Success`: When an API call succeeds
- `API_Call_Failure`: When an API call fails
- `Analyze_Text_Attempt`: When a user attempts to analyze text
- `Analyze_Text_Success`: When text analysis succeeds
- `Analyze_Text_Failure`: When text analysis fails

### Session Events
- `Session_Start`: When a user session begins
- `Session_End`: When a user session ends
- `Extension_Installed`: When the extension is installed
- `Extension_Updated`: When the extension is updated

### Feature Usage Events
- `Feature_Usage`: When a feature is used
- `Feature_Success`: When a feature completes successfully
- `Feature_Failure`: When a feature fails

### Performance Events
- `Page_Load_Time`: Time taken to load a page
- `Operation_Time`: Time taken for an operation
- `Login_Duration`: Time taken for login
- `Registration_Duration`: Time taken for registration

### Error Events
- `Error`: When an error occurs
- `Warning`: When a warning occurs

## Implementation Details

### Analytics Module
The `analytics.js` file contains all tracking functions and serves as the central point for analytics implementation.

### Content Script Tracking
The content script tracks:
- Profile visits
- Comment generation
- Connection message generation
- Reaction clicks

### Background Script Tracking
The background script tracks:
- API calls to Anthropic
- Extension installation and updates

### Popup Script Tracking
The popup script tracks:
- Button clicks
- Tab changes
- Settings changes
- Authentication events
- Session start/end

## User Identification

### Email-Based User Identification
We use email as the primary identifier for users in PostHog. This approach has several advantages:
- Emails are unique to each user
- Emails are consistent across sessions and devices
- Emails can be used to correlate data with other systems

The implementation includes:
1. **Supabase Integration**: We fetch user data from Supabase and use it to identify users in PostHog
2. **Standard Properties**: We set standard PostHog properties like `$email` and `$name`
3. **Custom Properties**: We add custom properties like account type and API key status
4. **User Aliasing**: We alias the Supabase user ID to the email for complete tracking

### User Properties
The following properties are set for each identified user:

#### Standard PostHog Properties
- `$email`: User's email address (standard PostHog property)
- `$name`: User's name or email username
- `$created`: When the user account was created

#### Account Information
- `last_login`: Last login timestamp
- `supabase_id`: User ID from Supabase
- `account_type`: User's account type (standard, premium, etc.)
- `api_key_set`: Whether the user has set an API key
- `email_domain`: Domain part of the user's email (useful for B2B analysis)

#### Usage Metrics
- `comment_count`: Number of comments generated
- `connection_messages_sent`: Number of connection messages generated
- `last_active`: Last activity timestamp

#### Device Information
- `browser`: User's browser (Chrome, Firefox, Safari, etc.)
- `device_type`: User's device type (Mobile or Desktop)

#### Custom User Metadata
- Any additional metadata from the Supabase user profile

### Person Profile Events
- `Person_Profile_Updated`: Triggered when a person profile is updated with new properties

## Person Profile Management

### Creation
Person profiles are automatically created when:
- A user logs in for the first time
- A user registers a new account
- An identified event is captured for a new user

### Updates
Person profiles are updated:
- On every login
- When user settings change
- When usage metrics change

### Display in PostHog
For better readability in the PostHog interface:
- Email is used as the primary identifier
- Name is set to the user's full name or email username
- Properties are organized by category

## Data Collection Guidelines

1. **Personal Information**: Avoid tracking sensitive personal information
2. **Passwords**: Never track passwords in production
3. **Performance**: Keep tracking payload size minimal
4. **Error Handling**: Always handle tracking errors gracefully
5. **Debugging**: Include detailed information for debugging purposes

## Future Enhancements

1. **User Segmentation**: Implement user segmentation based on usage patterns
2. **A/B Testing**: Set up A/B testing for new features
3. **Retention Analysis**: Track user retention metrics
4. **Funnel Analysis**: Create funnels for key user journeys
5. **Custom Dashboards**: Create custom dashboards for key metrics
