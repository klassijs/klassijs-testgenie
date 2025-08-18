const axios = require('axios');

// Azure OpenAI Configuration
const OPENAI_URL = process.env.OPENAI_URL;
const OPENAI_DEVELOPMENT_ID = process.env.OPENAI_DEVELOPMENT_ID;
const OPENAI_API_VERSION = process.env.OPENAI_API_VERSION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const isAzureOpenAIConfigured = OPENAI_URL && OPENAI_DEVELOPMENT_ID && OPENAI_API_VERSION && OPENAI_API_KEY;

// Generate test cases using Azure OpenAI
async function generateTestCases(content, context = '') {
  console.log('=== GENERATE TEST CASES DEBUG ===');
  console.log('Content length:', content.length);
  console.log('Content preview:', content.substring(0, 500));
  console.log('Context:', context);
  console.log('=== END DEBUG ===');
  
  if (!isAzureOpenAIConfigured) {
    throw new Error('Azure OpenAI is not configured');
  }
  
  // Check if content is sufficient
  if (!content || content.trim().length < 100) {
    throw new Error('Insufficient content. Please provide more detailed content for test generation');
  }

  // Clean up the URL to prevent duplication
  let baseUrl = OPENAI_URL;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Remove any existing /openai/deployments/ from the URL
  baseUrl = baseUrl.replace(/\/openai\/deployments\/?$/, '');
  
  const apiUrl = `${baseUrl}/openai/deployments/${OPENAI_DEVELOPMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  
  console.log(`Making Azure OpenAI request to: ${apiUrl}`);

  const messages = [
    {
      role: 'system',
      content: `You are a Test Automation Architect specializing in analysing documents and creating comprehensive Cucumber test cases in Gherkin syntax.

Your task is to analyze the provided content and generate comprehensive test cases including:

POSITIVE TEST SCENARIOS:
- Happy path scenarios
- User stories and requirements
- Business rules and acceptance criteria
- Integration points and workflows
- Data-driven scenarios with multiple examples

EDGE CASES AND NEGATIVE TEST SCENARIOS:
- Boundary value testing (minimum/maximum values)
- Invalid input scenarios (empty fields, special characters, very long text)
- Error conditions and exception handling
- Invalid data formats and malformed inputs
- Timeout and performance edge cases
- Security-related negative scenarios
- Business rule violations
- Invalid state transitions
- Network/connectivity failures
- Data validation failures

For each feature, generate test cases in proper Gherkin syntax with:
- Feature files with clear descriptions
- Scenario outlines for data-driven tests
- Background steps for common setup
- Proper Given/When/Then structure
- Meaningful test data and examples
- Both positive and negative scenarios
- Edge cases with boundary values

CRITICAL REQUIREMENTS:
- Generate ONLY pure Gherkin syntax (Feature, Scenario, Given, When, Then, And, But)
- Include both positive scenarios and negative/edge case scenarios
- Use descriptive scenario names that clearly indicate positive vs negative testing
- Do NOT include any explanations, comments, or descriptions about the test cases.
- Do NOT include sections like "### Explanation:", "This Gherkin syntax covers...", "Certainly! Below are...", or any introductory/concluding remarks.
- Start directly with 'Feature:' and end with the last test scenario.
- Ensure the output is ready to be saved directly as a .feature file.`
    },
    {
      role: 'user',
      content: `Generate Gherkin test cases for the following content:

${content}

Additional context: ${context}`
    }
  ];

  try {
    const response = await axios.post(
      apiUrl,
      {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "text" }
      },
      {
        headers: {
          'api-key': OPENAI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Azure OpenAI Response Status:', response.status);
    console.log('Azure OpenAI Response Data:', JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error(`Invalid response structure from Azure OpenAI: ${JSON.stringify(response.data)}`);
    }

    // Check if content was filtered
    if (response.data.choices[0].finish_reason === 'content_filter') {
      const filterResults = response.data.choices[0].content_filter_results;
      const filteredCategories = Object.entries(filterResults)
        .filter(([_, result]) => result.filtered)
        .map(([category, result]) => `${category}: ${result.severity}`)
        .join(', ');
      
      throw new Error(`Content was filtered by Azure OpenAI safety filters: ${filteredCategories}. Please try rephrasing your request or using different content.`);
    }

    // Check if message has content
    if (!response.data.choices[0].message.content) {
      throw new Error(`No content received from Azure OpenAI. Response: ${JSON.stringify(response.data.choices[0])}`);
    }

    let generatedTests = response.data.choices[0].message.content;

    // Clean up any explanations that might have slipped through
    const cleanGeneratedTests = generatedTests
      .replace(/### Explanation:[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/This Gherkin syntax covers[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/Certainly! Below are[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/The following Gherkin scenarios[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/Here are the Gherkin test cases[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/```gherkin\\n/gi, '')
      .replace(/```\\n/gi, '')
      .trim();

    return cleanGeneratedTests;
  } catch (error) {
    console.error('Azure OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`Azure OpenAI API Error: ${error.response?.status || error.message}`);
  }
}

// Refine test cases using Azure OpenAI
async function refineTestCases(content, feedback, context = '') {
  if (!isAzureOpenAIConfigured) {
    throw new Error('Azure OpenAI is not configured');
  }

  // Clean up the URL to prevent duplication
  let baseUrl = OPENAI_URL;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Remove any existing /openai/deployments/ from the URL
  baseUrl = baseUrl.replace(/\/openai\/deployments\/?$/, '');
  
  const apiUrl = `${baseUrl}/openai/deployments/${OPENAI_DEVELOPMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;

  const messages = [
    {
      role: 'system',
      content: `You are a Test Automation Architect specializing in analysing documents and creating comprehensive Cucumber test cases in Gherkin syntax.

Your task is to refine the provided test cases based on the feedback given. When refining, ensure comprehensive coverage including:

POSITIVE TEST SCENARIOS:
- Happy path scenarios
- Business rules and acceptance criteria
- Data-driven scenarios with multiple examples

EDGE CASES AND NEGATIVE TEST SCENARIOS:
- Boundary value testing (minimum/maximum values)
- Invalid input scenarios (empty fields, special characters, very long text)
- Error conditions and exception handling
- Invalid data formats and malformed inputs
- Timeout and performance edge cases
- Security-related negative scenarios
- Business rule violations
- Invalid state transitions
- Network/connectivity failures
- Data validation failures

CRITICAL REQUIREMENTS:
- Generate ONLY pure Gherkin syntax (Feature, Scenario, Given, When, Then, And, But)
- Include both positive scenarios and negative/edge case scenarios
- Use descriptive scenario names that clearly indicate positive vs negative testing
- Do NOT include any explanations, comments, or descriptions about the test cases.
- Do NOT include sections like "### Explanation:", "This Gherkin syntax covers...", "Certainly! Below are...", or any introductory/concluding remarks.
- Start directly with 'Feature:' and end with the last test scenario.
- Ensure the output is ready to be saved directly as a .feature file.`
    },
    {
      role: 'user',
      content: `Refine the following Gherkin test cases based on this feedback: "${feedback}"

Current test cases:
${content}

Additional context: ${context}`
    }
  ];

  try {
    const response = await axios.post(
      apiUrl,
      {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "text" }
      },
      {
        headers: {
          'api-key': OPENAI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Azure OpenAI Refine Response Status:', response.status);
    console.log('Azure OpenAI Refine Response Data:', JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error(`Invalid response structure from Azure OpenAI: ${JSON.stringify(response.data)}`);
    }

    // Check if content was filtered
    if (response.data.choices[0].finish_reason === 'content_filter') {
      const filterResults = response.data.choices[0].content_filter_results;
      const filteredCategories = Object.entries(filterResults)
        .filter(([_, result]) => result.filtered)
        .map(([category, result]) => `${category}: ${result.severity}`)
        .join(', ');
      
      throw new Error(`Content was filtered by Azure OpenAI safety filters: ${filteredCategories}. Please try rephrasing your request or using different content.`);
    }

    // Check if message has content
    if (!response.data.choices[0].message.content) {
      throw new Error(`No content received from Azure OpenAI. Response: ${JSON.stringify(response.data.choices[0])}`);
    }

    let refinedTests = response.data.choices[0].message.content;

    // Clean up any explanations that might have slipped through
    const cleanRefinedTests = refinedTests
      .replace(/### Explanation:[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/This Gherkin syntax covers[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/Certainly! Below are[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/The following Gherkin scenarios[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/Here are the Gherkin test cases[\s\S]*?(?=Feature:|$)/gi, '')
      .replace(/```gherkin\\n/gi, '')
      .replace(/```\\n/gi, '')
      .trim();

    return cleanRefinedTests;
  } catch (error) {
    console.error('Azure OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`Azure OpenAI API Error: ${error.response?.status || error.message}`);
  }
}

module.exports = {
  generateTestCases,
  refineTestCases,
  isAzureOpenAIConfigured
}; 
