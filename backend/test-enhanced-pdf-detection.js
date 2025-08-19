const { countBusinessElementsDeterministically } = require('./utils/fileProcessor');

console.log('🧪 Testing Enhanced PDF Business Element Detection with Debugging\n');

// Simulated content that would match a real PDF like "UK Teacher Plus Process Flow V0.4.pdf"
const realisticPDFContent = `# UK Teacher Plus Process Flow V0.4

## Document Analysis

### Extracted Content:

## Business Requirements:

1. The system shall support teacher registration and profile creation
2. The system must handle teacher qualification verification
3. The system will support lesson planning and scheduling
4. The system shall provide student progress tracking
5. The system must support assessment and grading functionality
6. The system will handle parent communication features
7. The system shall support curriculum management
8. The system must provide reporting and analytics capabilities

## Process Steps:

• Teacher logs into the system
• Teacher creates lesson plans
• Teacher records student attendance
• Teacher inputs assessment scores
• Teacher generates progress reports
• Teacher communicates with parents

## Business Rules:

- Teachers must have valid qualifications
- Lesson plans must be approved by administrators
- Student data must be kept confidential
- Assessments must follow curriculum standards
- Reports must be generated monthly

## Functional Requirements:

a) User authentication and authorization
b) Data backup and recovery
c) Integration with school management systems
d) Mobile device compatibility
e) Multi-language support
f) Accessibility compliance

## User Stories:

As a teacher, I want to easily create lesson plans so that I can prepare for my classes efficiently.
As a teacher, I want to track student progress so that I can identify areas for improvement.
As a teacher, I want to communicate with parents so that we can work together for student success.

## System Features:

* Dashboard with key metrics
* Calendar integration
* Document management
* Communication tools
* Assessment tools
* Reporting engine

## Integration Points:

- School Information System (SIS)
- Learning Management System (LMS)
- Parent Portal
- Student Database
- Assessment Platform

## Security Requirements:

- Role-based access control
- Data encryption at rest
- Secure authentication
- Audit logging
- GDPR compliance

## Data Entities:

- Teacher profiles
- Student records
- Lesson plans
- Assessment data
- Progress reports
- Communication logs`;

console.log('📊 Testing Enhanced Detection on Realistic PDF Content');
const result = countBusinessElementsDeterministically(realisticPDFContent);

console.log(`\n🎯 Results:`);
console.log(`Total Business Elements: ${result.count}`);
console.log(`\nBreakdown:`);
console.log(`- Business Processes: ${result.breakdown.processes}`);
console.log(`- System Requirements: ${result.breakdown.requirements}`);
console.log(`- Decision Points: ${result.breakdown.decisions}`);
console.log(`- Process Steps: ${result.breakdown.steps}`);
console.log(`- Business Flows: ${result.breakdown.flows}`);
console.log(`- User Actions: ${result.breakdown.userActions}`);

console.log(`\n📋 Detailed Elements:`);
result.elements.forEach((element, index) => {
  console.log(`${index + 1}. ${element.type} (${element.priority}): ${element.text.substring(0, 60)}${element.text.length > 60 ? '...' : ''}`);
});

console.log(`\n🎯 Priority Breakdown:`);
console.log(`- High Priority: ${result.priorities.high}`);
console.log(`- Medium Priority: ${result.priorities.medium}`);
console.log(`- Low Priority: ${result.priorities.low}`);

console.log(`\n✅ Expected Count: 30-40 business requirements`);
console.log(`✅ Actual Count: ${result.count} business elements`);
console.log(`✅ Detection Accuracy: ${result.count >= 30 && result.count <= 40 ? 'PERFECT' : result.count >= 25 && result.count <= 45 ? 'GOOD' : 'NEEDS ADJUSTMENT'}`);

if (result.count < 25) {
  console.log(`\n⚠️  Under-counting detected. Need to relax some filters.`);
} else if (result.count > 45) {
  console.log(`\n⚠️  Over-counting detected. Need to tighten some filters.`);
} else {
  console.log(`\n🎉 Successfully detecting the expected range of business elements!`);
}
