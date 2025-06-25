# AI Chat App

A modern AI chat application built with React, Electron, TypeScript, and Google Gemini AI.

## Features

- 🤖 **AI Chat Interface**: Chat with Google Gemini AI using natural language
- 💬 **Real-time Messaging**: Send and receive messages with a beautiful UI
- ⚡ **Streaming Responses**: Real-time streaming of AI responses for better user experience
- 🔐 **Secure API Handling**: API calls go through Electron's main process for enhanced security
- 📸 **Screenshot to Clipboard**: Capture screenshots directly to clipboard using native system tools
- 📱 **Cross-platform**: Works on Windows, macOS, and Linux
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- ⚡ **Fast Performance**: Built with Vite for quick development and builds

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd app
npm install
```

### 2. Get a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
# .env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

**Important**: Replace `your_actual_gemini_api_key_here` with your real Gemini API key.

### 4. Run the Application

```bash
npm run dev
```

This will start both the React development server and Electron app.

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint
- `npm run dist:mac` - Build macOS distribution

## Project Structure

```
src/
├── electron/          # Electron main process
│   ├── main.ts        # Main process entry point
│   ├── preload.ts     # Preload script for secure IPC
│   └── util.ts        # Utility functions
├── renderer/          # React application
│   ├── components/    # React components
│   ├── services/      # API services (now uses IPC)
│   └── App.tsx        # Main app component
└── vite-env.d.ts      # Vite type definitions
```

## Key Components

- **ChatContainer**: Displays chat messages with auto-scroll
- **ChatInput**: Message input with auto-resize and send functionality
- **ChatMessage**: Individual message display component
- **GeminiService**: Handles AI interactions through Electron IPC

## Architecture

### Security-First Design

This application uses a secure architecture where:

1. **Main Process**: Handles all API calls to Gemini with access to environment variables
2. **Preload Script**: Safely exposes IPC methods to the renderer process
3. **Renderer Process**: React app that communicates with the main process via IPC
4. **Context Isolation**: Prevents direct access to Node.js APIs from the renderer

### API Flow

```
User Input → React Component → IPC Call → Main Process → Gemini API → Response → IPC Response → React Component → UI Update
```

## Features in Detail

### Chat Interface

- Real-time message display
- Auto-scroll to latest messages
- Message timestamps
- Loading states during AI responses
- Error handling and display

### Streaming Responses

- **Real-time Streaming**: AI responses appear word-by-word as they're generated
- **Visual Indicators**: Typing animations show when AI is responding
- **Smooth UX**: No waiting for complete responses before seeing content
- **Error Handling**: Graceful fallback to non-streaming mode if needed
- **Performance**: Faster perceived response times with streaming

### Environment Configuration

- Secure API key storage in environment variables
- API key only accessible in the main process
- No need for manual API key input
- Easy configuration management

### UI/UX

- Responsive design
- Dark/light theme support
- Smooth animations
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Auto-resizing text input

## Environment Variables

| Variable         | Description                | Required |
| ---------------- | -------------------------- | -------- |
| `GEMINI_API_KEY` | Your Google Gemini API key | Yes      |

## Troubleshooting

### Common Issues

1. **API Key Not Working**

   - Make sure you have a valid Gemini API key
   - Check that your `.env` file is in the root directory
   - Verify the environment variable name is `GEMINI_API_KEY`
   - Check your internet connection
   - Restart the application after adding the API key

2. **App Won't Start**

   - Ensure Node.js is installed (v16+)
   - Run `npm install` to install dependencies
   - Check console for error messages
   - Make sure the preload script is compiled: `npm run transpile:electron`

3. **Build Issues**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Update dependencies: `npm update`
   - Ensure TypeScript compilation works: `npm run transpile:electron`

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file should be added to `.gitignore`
- API keys are only accessible in the main process, not the renderer
- Context isolation prevents unauthorized access to Node.js APIs
- IPC communication is used for secure data exchange between processes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
