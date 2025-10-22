# Klassi-AI

AI-powered test automation platform for generating Cucumber test cases from business requirements.

## Installation

```bash
npm install klassi-ai
```

## Quick Start

After installation, you can start the Klassi-AI application:

```bash
# Start the development server
npx klassi-ai dev

# Or start production server
npx klassi-ai start

# Build the application
npx klassi-ai build
```

## Usage

### Command Line Interface

```bash
# Start development server (recommended)
npx klassi-ai dev

# Start production server
npx klassi-ai start

# Build the application
npx klassi-ai build
```

### Programmatic Usage

```javascript
const KlassiAI = require('klassi-ai');

const klassiAI = new KlassiAI();

// Start development server
await klassiAI.startDev();

// Start production server
await klassiAI.start();

// Build the application
await klassiAI.build();
```

## Features

- **AI-Powered Test Generation**: Generate Cucumber/Gherkin test cases from business requirements
- **Document Processing**: Upload and process various document formats (PDF, DOCX, Excel)
- **Jira Integration**: Import requirements directly from Jira tickets
- **Zephyr Scale Integration**: Push generated tests to Zephyr Scale
- **Requirements Management**: Edit and validate business requirements
- **Test Validation**: Quality scoring and recommendations for generated tests

## Requirements

- Node.js >= 16.0.0
- pnpm >= 8.0.0

## Configuration

The application will start on:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Environment Variables

Create a `.env` file in your project root with the following variables:

```env
OPENAI_API_KEY=your_openai_api_key
JIRA_BASE_URL=your_jira_url
JIRA_USERNAME=your_jira_username
JIRA_API_TOKEN=your_jira_token
ZEPHYR_BASE_URL=your_zephyr_url
ZEPHYR_ACCESS_KEY=your_zephyr_access_key
ZEPHYR_SECRET_KEY=your_zephyr_secret_key
```

## Integration with Klassi-js

This package is designed to work seamlessly with [Klassi-js](https://github.com/klassijs/klassi-js):

```json
{
  "dependencies": {
    "klassi-js": "^1.0.0",
    "klassi-ai": "^1.0.0"
  },
  "scripts": {
    "start-testgen": "klassi-ai dev",
    "run-tests": "klassi-js run"
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [https://github.com/klassijs/klassi-ai/issues](https://github.com/klassijs/klassi-ai/issues)
- Documentation: [https://github.com/klassijs/klassi-ai#readme](https://github.com/klassijs/klassi-ai#readme)

## Creator

**Larry Goddard**
- GitHub: [https://github.com/klassijs](https://github.com/klassijs)
- LinkedIn: [https://linkedin.com/in/larryg](https://linkedin.com/in/larryg)
- YouTube: [https://youtube.com/@LarryG_01](https://youtube.com/@LarryG_01)

## Contributors

- **Carlos Bermejo** - [https://github.com/carlosbermejop](https://github.com/carlosbermejop)
- **Arthur East** - [https://github.com/arthureast](https://github.com/arthureast)
