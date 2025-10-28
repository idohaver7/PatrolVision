# PatrolVision AI Coding Instructions 

## Project Overview
PatrolVision is a React Native mobile application with a server component for traffic violation detection and management. The project consists of two main parts:
- `PatrolVisionApp/`: React Native mobile application
- `Server/`: Backend server (implementation details TBD)

## Architecture & Structure

### Mobile App Architecture
- Entry point: `App.tsx` - Root component mounting main screens
- Screen components in `src/screens/` - Each screen is a standalone component
- Component patterns:
  - Screens use `SafeAreaView` as root component
  - Consistent styling structure using `StyleSheet.create()`
  - Mock data defined within components during development

### Key Examples:
See `src/screens/ViolationsHistoryScreen.js` for reference implementation of:
- Screen layout and component structure
- Styling patterns and color schemes
- Data structure for violations
- List rendering with `FlatList`

## Development Workflow

### Environment Setup
1. Install dependencies:
```sh
cd PatrolVisionApp
npm install
```

2. iOS specific setup:
```sh
bundle install
bundle exec pod install
```

### Running the App
1. Start Metro bundler:
```sh
npm start
```

2. Build and run:
- Android: `npm run android`
- iOS: `npm run ios`

### Development Conventions
- TypeScript is used for new components (`.tsx` extension)
- Consistent style structure using `StyleSheet.create()`
- Component organization:
  - Screens in `src/screens/`
  - Components use functional style with hooks
  - Mock data defined separately for development

## Data Patterns
Violation data structure:
```typescript
interface Violation {
  id: string;
  type: string;
  license_plate: string;
  date: string;
  image_url: string;
}
```

## Common Tasks
1. Adding a new screen:
   - Create screen component in `src/screens/`
   - Use `SafeAreaView` as root component
   - Follow styling patterns from `ViolationsHistoryScreen.js`

2. Running tests:
   - Unit tests: `npm test`
   - Test files located in `__tests__/`

## Debugging
- React Native dev menu:
  - Android: `Ctrl/Cmd + M`
  - iOS: Shake device or `Cmd + D` in simulator
- Fast Refresh enabled by default
- Force reload: Press `R` twice (Android) or once (iOS)