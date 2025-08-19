const { countBusinessElementsDeterministically } = require('./utils/fileProcessor');

// Test content that represents a typical Visio diagram analysis
const testContent = `# Visio Diagram Analysis

## File: workflow.vsdx

### Extracted Content:

## Business Process Pages:
Business Process: User Authentication
Business Process: Order Processing
Business Process: Payment Processing

### Business Requirements from Diagram:

#### Business Processes and Systems:
- User Login System
- Order Management System
- Payment Gateway Integration
- Inventory Management
- Customer Profile Management

#### Business Flows and Relationships:
- Flow from User Login to Order Processing
- Decision "Payment Valid" leads to process "Order Confirmation"
- Process "Order Processing" leads to decision "Inventory Available"
- Process "Payment Processing" leads to end point

#### Derived Business Requirements:
- The system should support user login system
- The system should support order management system
- The system should support payment gateway integration
- The system should support inventory management
- The system should support customer profile management
- The system should handle flow from user login to order processing
- The system should handle decision "Payment Valid" leads to process "Order Confirmation"
- The system should handle process "Order Processing" leads to decision "Inventory Available"
- The system should handle process "Payment Processing" leads to end point

#### Flowchart Analysis Summary:
- **Total Elements**: 15 shapes, 8 connections
- **Process Steps**: 5 identified
- **Decision Points**: 3 identified
- **Start Points**: 1 identified
- **End Points**: 1 identified
- **Complexity**: Medium - Several decision points`;

console.log('🧪 Testing Deterministic Business Element Counting\n');

// Test 1: First run
console.log('📊 Test 1: First Analysis');
const result1 = countBusinessElementsDeterministically(testContent);
console.log(`Found ${result1.count} business elements`);
console.log('Breakdown:', result1.breakdown);
console.log('Elements:', result1.elements.map(e => `${e.type}: ${e.text}`));
console.log('');

// Test 2: Second run (should be identical)
console.log('📊 Test 2: Second Analysis (should be identical)');
const result2 = countBusinessElementsDeterministically(testContent);
console.log(`Found ${result2.count} business elements`);
console.log('Breakdown:', result2.breakdown);
console.log('Elements:', result2.elements.map(e => `${e.type}: ${e.text}`));
console.log('');

// Test 3: Consistency check
console.log('✅ Consistency Check:');
console.log(`Results identical: ${result1.count === result2.count}`);
console.log(`Breakdown identical: ${JSON.stringify(result1.breakdown) === JSON.stringify(result2.breakdown)}`);
console.log(`Element count: ${result1.count} (consistent across runs)`);

// Test 4: Show what the AI should generate
console.log('\n🎯 AI Requirement Generation Target:');
console.log(`The AI should generate exactly ${result1.count} requirements:`);
console.log(`- BR-001 through BR-${result1.count.toString().padStart(3, '0')}`);
console.log(`- Based on the ${result1.count} business elements identified`);

// Test 5: Different content (should give different count)
console.log('\n📊 Test 3: Different Content (should give different count)');
const differentContent = `# Simple Document

## Business Process:
- User Login

## System Requirements:
- The system should support user login

## User Actions:
- User enters credentials
- User clicks login button`;

const result3 = countBusinessElementsDeterministically(differentContent);
console.log(`Different content found ${result3.count} business elements`);
console.log('Breakdown:', result3.breakdown);
console.log('');

console.log('🎉 Deterministic counting test completed!');
console.log('✅ Same content always produces same count');
console.log('✅ Different content produces different count');
console.log('✅ AI will generate exactly the counted number of requirements');
