// /**
//  * Test script for workflow analyzer
//  * Run with: node test-workflow-analyzer.js
//  */
//
// const { analyzeWorkflowContent, generateComplexityDescription, analyzeBPMNContent, categorizeRequirementComplexity, validateTestCoverage } = require('./utils/workflowAnalyzer');
//
// // Test content with workflow elements
// const testContent = `
// Process 1: Indirect Purchasing
// - Start Event: Purchase Request
// - User Task: Review Purchase Request
// - Exclusive Gateway: Is approval required?
//   - Yes: User Task: Manager Approval
//   - No: Service Task: Process Purchase
// - Parallel Gateway: Multiple approvals
//   - User Task: Finance Approval
//   - User Task: Legal Review
// - Inclusive Gateway: Additional checks
//   - Service Task: Budget Check
//   - Service Task: Vendor Validation
// - End Event: Purchase Complete
//
// Process 2: Direct Purchasing
// - Start Event: Direct Purchase Request
// - User Task: Select Vendor
// - Exclusive Gateway: Vendor approved?
//   - Yes: Service Task: Process Payment
//   - No: User Task: Vendor Approval
// - End Event: Purchase Complete
// `;
//
// console.log('🔍 Testing Workflow Analyzer...\n');
//
// // Test basic workflow analysis
// console.log('📊 Basic Workflow Analysis:');
// const analysis = analyzeWorkflowContent(testContent);
// console.log(JSON.stringify(analysis, null, 2));
//
// console.log('\n🔍 BPMN Content Analysis:');
// const bpmnAnalysis = analyzeBPMNContent(testContent);
// console.log(JSON.stringify(bpmnAnalysis, null, 2));
//
// console.log('\n📋 Complexity Descriptions:');
// console.log('Simple requirement:', generateComplexityDescription(analysis, 'User should be able to login'));
// console.log('Workflow requirement:', generateComplexityDescription(analysis, 'System should handle purchase approval workflow'));
//
// console.log('\n🧠 Smart Categorization Examples:');
// console.log('Login requirement:', categorizeRequirementComplexity('User login', 'Given credentials, When submitted, Then access granted'));
// console.log('Form validation:', categorizeRequirementComplexity('Input validation', 'Given form data, When validated, Then errors shown'));
// console.log('CRUD operation:', categorizeRequirementComplexity('Create user', 'Given user data, When created, Then user saved'));
// console.log('Workflow process:', categorizeRequirementComplexity('Approval workflow', 'Given request, When processed, Then routed through approvals'));
// console.log('Integration:', categorizeRequirementComplexity('API integration', 'Given external service, When called, Then data returned'));
//
// console.log('\n🔍 Test Coverage Validation Examples:');
// const sampleTestContent = `
// Feature: Purchase Approval Workflow
//
// Scenario: BR-001: Manager approves purchase request
//   Given a purchase request is submitted
//   When the manager reviews and approves
//   Then the request proceeds to finance
//
// Scenario: BR-001: Manager rejects purchase request
//   Given a purchase request is submitted
//   When the manager reviews and rejects
//   Then the request is returned to requester
//
// Scenario: BR-001: Finance approves purchase
//   Given an approved purchase request
//   When finance reviews and approves
//   Then the purchase is processed
// `;
//
// const complexityInfo = 'CC: 6, Decision Points: 9, Activities: 15, Paths: 6';
// const coverageValidation = validateTestCoverage(sampleTestContent, complexityInfo);
// console.log('Coverage Validation:', JSON.stringify(coverageValidation, null, 2));
//
// console.log('\n✅ Test completed!');
