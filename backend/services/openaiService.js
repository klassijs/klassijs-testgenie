const axios = require('axios');

const OPENAI_URL = process.env.OPENAI_URL;
const OPENAI_DEVELOPMENT_ID = process.env.OPENAI_DEVELOPMENT_ID;
const OPENAI_API_VERSION = process.env.OPENAI_API_VERSION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const isAzureOpenAIConfigured = OPENAI_URL && OPENAI_DEVELOPMENT_ID && OPENAI_API_VERSION && OPENAI_API_KEY;

// Generate test cases using Azure OpenAI
async function generateTestCases(content, context = '') {
  
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
  


  const messages = [
    {
      role: 'system',
      content: `You are a Test Automation Architect creating Cucumber test cases in Gherkin syntax.

Your task is to analyze the EXACT requirement and acceptance criteria provided and generate MULTIPLE test scenarios that thoroughly test that SPECIFIC functionality.

IMPORTANT: You must generate test scenarios that are SPECIFIC to the provided business requirement and acceptance criteria. Do NOT generate generic test scenarios.

For each acceptance criteria, generate AT LEAST 5 different test scenarios including:

POSITIVE TEST SCENARIOS:
- Happy path scenarios (main success flow)
- Valid data variations
- Different user roles/permissions
- Various input combinations
- Successful edge cases

NEGATIVE TEST SCENARIOS:
- Invalid input scenarios (empty fields, special characters, very long text)
- Error conditions and exception handling
- Boundary value testing (minimum/maximum values)
- Invalid data formats and malformed inputs
- Business rule violations
- Invalid state transitions
- Security-related negative scenarios

DATA-DRIVEN SCENARIOS:
- Scenario outlines with multiple examples
- Different data combinations
- Various test conditions

CRITICAL REQUIREMENTS:
- Generate ONLY pure Gherkin syntax (Feature, Scenario, Given, When, Then, And, But)
- Generate MULTIPLE scenarios (3-5 minimum) for each acceptance criteria
- Include both positive scenarios and negative/edge case scenarios
- Use descriptive scenario names that clearly indicate what is being tested
- Do NOT generate generic test scenarios
- Do NOT include any explanations, comments, or descriptions about the test cases
- Do NOT include sections like "### Explanation:", "This Gherkin syntax covers...", "Certainly! Below are...", or any introductory/concluding remarks
- Do NOT include example scenarios or sample test cases
- Do NOT include any text that starts with "Example:", "Sample:", "Here's an example:", or similar
- Start directly with 'Feature:' and end with the last test scenario
- Ensure the output is ready to be saved directly as a .feature file
- Each scenario should test a different aspect or variation of the acceptance criteria
- Output ONLY the actual test scenarios, nothing else
- The Feature name and scenarios must be based on the SPECIFIC business requirement provided`
    },
    {
      role: 'user',
      content: `IMPORTANT: You are testing the EXACT requirement provided below. Generate test scenarios ONLY for this specific requirement.

REQUIREMENT TO TEST:
${content}

Additional context: ${context}

CRITICAL REQUIREMENTS:
- Generate test scenarios that are SPECIFIC to the business requirement and acceptance criteria provided above
- Do NOT generate generic test scenarios like "User Registration" or "Login"
- Do NOT create test scenarios for functionality not mentioned in the requirement
- Each scenario must directly relate to the provided business requirement and acceptance criteria
- Generate multiple scenarios (positive, negative, edge cases) for this single acceptance criteria
- Each scenario should test a different aspect or variation of the provided acceptance criteria
- Output ONLY the actual Gherkin test scenarios
- Do NOT include any examples, explanations, or sample scenarios
- Start directly with 'Feature:' and end with the last test scenario
- The Feature name should be based on the business requirement provided
- If the requirement mentions "ProQuest Orders", the Feature should be about "ProQuest Orders"
- If the requirement mentions "Salesforce", the scenarios should involve "Salesforce"
- Use the EXACT terminology from the requirement in your test scenarios`
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
      .replace(/### Explanation:[\s\S]*?(?=Feature:|$)/gi, '') // Remove explanation sections
      .replace(/This Gherkin syntax covers[\s\S]*?(?=Feature:|$)/gi, '') // Remove introductory explanations
      .replace(/Certainly! Below are[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Certainly! Below are..."
      .replace(/The following Gherkin scenarios[\s\S]*?(?=Feature:|$)/gi, '') // Remove "The following Gherkin scenarios..."
      .replace(/Here are the Gherkin test cases[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Here are the Gherkin test cases..."
      .replace(/```gherkin\\n/gi, '') // Remove leading ```gherkin
      .replace(/```\\n/gi, '') // Remove trailing ```
      .trim(); // Trim any leading/trailing whitespace

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
      .replace(/### Explanation:[\s\S]*?(?=Feature:|$)/gi, '') // Remove explanation sections
      .replace(/This Gherkin syntax covers[\s\S]*?(?=Feature:|$)/gi, '') // Remove introductory explanations
      .replace(/Certainly! Below are[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Certainly! Below are..."
      .replace(/The following Gherkin scenarios[\s\S]*?(?=Feature:|$)/gi, '') // Remove "The following Gherkin scenarios..."
      .replace(/Here are the Gherkin test cases[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Here are the Gherkin test cases..."
      .replace(/```gherkin\\n/gi, '') // Remove leading ```gherkin
      .replace(/```\\n/gi, '') // Remove trailing ```
      .trim(); // Trim any leading/trailing whitespace

    return cleanRefinedTests;
  } catch (error) {
    console.error('Azure OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`Azure OpenAI API Error: ${error.response?.status || error.message}`);
  }
}

// Extract business requirements and acceptance criteria from documents
async function extractBusinessRequirements(content, context = '') {
  if (!isAzureOpenAIConfigured) {
    throw new Error('Azure OpenAI is not configured');
  }
  
  // Check if content is sufficient
  if (!content || content.trim().length < 50) {
    throw new Error('Insufficient content. Please provide more detailed content for requirement extraction');
  }

  // Handle large documents with chunking
  let processedContent = content;
  if (content.length > 100000) {

    
    // For very large documents, use the first 100K chars (about 25K tokens)
    // This leaves plenty of room for the prompt and response
    processedContent = content.substring(0, 100000);
    
    // Try to end at a natural boundary
    const lastPeriod = processedContent.lastIndexOf('.');
    const lastNewline = processedContent.lastIndexOf('\n');
    const endPoint = Math.max(lastPeriod, lastNewline);
    
    if (endPoint > 80000) {
      processedContent = processedContent.substring(0, endPoint + 1);
    }
    
    processedContent += '\n\n[Document truncated for processing. Full analysis may require multiple uploads.]';
    
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
      content: `You are a Business Analyst specializing in extracting business requirements from various document types including diagrams, flowcharts, and technical specifications.

Extract business requirements and create a markdown table with these columns:

| Requirement ID | Business Requirement | Acceptance Criteria |

CRITICAL REQUIREMENTS:
- EVERY business requirement MUST have a corresponding acceptance criteria
- NO requirement should be left without acceptance criteria
- If a business requirement is identified, you MUST create acceptance criteria for it
- Acceptance criteria should be specific, measurable, and testable
- Use Given-When-Then format for acceptance criteria where applicable

SPECIAL INSTRUCTIONS FOR DIAGRAM CONTENT:
- When analyzing diagram content, focus on business processes, systems, actors, and flows
- If the diagram is a flowchart, extract the requirements from the flowchart
- Extract requirements from business process components and their relationships
- Convert visual elements into functional requirements
- Identify data flows, system integrations, and user interactions
- Look for business rules, decision points, and process steps

Ensure that:
- Requirements are written in clear, concise, and testable language
- Acceptance criteria follow the Given-When-Then format where applicable
- Group related requirements logically if needed
- Start directly with the table, no explanations
- For diagram content, create requirements that reflect the business processes shown
- EVERY business requirement MUST have acceptance criteria - this is mandatory`
    },
    {
      role: 'user',
      content: `Please analyze the following document and extract the key business requirements and their corresponding acceptance criteria. Structure the output as a table with the following columns:

Requirement ID
Business Requirement (What the system should do)
Acceptance Criteria (How we know the requirement is met)

CRITICAL REQUIREMENTS:
- EVERY business requirement MUST have a corresponding acceptance criteria
- NO requirement should be left without acceptance criteria
- If you identify a business requirement, you MUST create acceptance criteria for it
- Acceptance criteria should be specific, measurable, and testable
- Use Given-When-Then format for acceptance criteria where applicable

Ensure that:
- Requirements are written in clear, concise, and testable language
- Acceptance criteria follow the Given-When-Then format where applicable
- Group related requirements logically if needed
- EVERY business requirement MUST have acceptance criteria - this is mandatory

Document to analyze:

${processedContent}

Additional context: ${context}`
    }
  ];

  try {

    
    const response = await axios.post(
        apiUrl,
        {
          messages: messages,
          max_tokens: 4000,
          temperature: 0.3,
          response_format: { type: "text" }
        },
        {
          headers: {
            'api-key': OPENAI_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );



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

    let extractedRequirements = response.data.choices[0].message.content;

    // Clean up the response
    extractedRequirements = extractedRequirements.trim();
    
    // Remove any markdown code blocks if present
    extractedRequirements = extractedRequirements.replace(/```markdown\n?/g, '').replace(/```\n?/g, '');

    return {
      success: true,
      content: extractedRequirements,
      message: 'Successfully extracted business requirements and acceptance criteria'
    };

  } catch (error) {
    console.error('Error extracting business requirements:', error);
    
    let errorMessage = 'Failed to extract business requirements';
    let suggestion = 'Please try again';
    
    if (error.response) {
      const errorData = error.response.data;
      console.error('Azure OpenAI Error Response:', JSON.stringify(errorData, null, 2));
      errorMessage = errorData.error?.message || errorData.error || errorMessage;
      suggestion = errorData.suggestion || suggestion;
    } else if (error.request) {
      errorMessage = 'Network error - unable to connect to server';
      suggestion = 'Please check your connection and try again';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    throw new Error(`${errorMessage}. ${suggestion}`);
  }
}

module.exports = {
  generateTestCases,
  refineTestCases,
  isAzureOpenAIConfigured,
  extractBusinessRequirements
}; 