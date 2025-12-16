/**
 * LangChain Prompt Templates
 * Story 3.1: AI Service Infrastructure
 */

import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';

// Legal document summary prompt
export const documentSummaryPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a legal assistant specializing in document analysis for law firms.
Your task is to provide concise, accurate summaries of legal documents.
Focus on key points, parties involved, dates, and obligations.
Always maintain professional legal terminology.
Context: {context}`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Please summarize the following legal document:

{document}

Provide a summary with the following sections:
1. Document Type
2. Key Parties
3. Main Terms/Provisions
4. Important Dates
5. Notable Clauses or Risks`
  ),
]);

// Legal analysis prompt
export const legalAnalysisPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are an expert legal analyst assisting attorneys with case analysis.
Provide thorough, well-reasoned analysis based on the provided materials.
Cite specific references when applicable.
Identify potential issues, risks, and opportunities.
Context: {context}`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Analyze the following legal matter:

{content}

Please provide analysis covering:
1. Key Legal Issues
2. Relevant Precedents or Standards
3. Strengths and Weaknesses
4. Risk Assessment
5. Recommended Actions`
  ),
]);

// Classification prompt for determining document/task type
export const classificationPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a classification system for legal documents and tasks.
Classify the input into one of the predefined categories.
Respond with only the category name, nothing else.`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Categories: {categories}

Classify the following:
{content}

Category:`
  ),
]);

// Entity extraction prompt
export const extractionPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are an information extraction system for legal documents.
Extract structured data from the provided text.
Return the data in valid JSON format.
Only include information explicitly stated in the text.`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Extract the following fields from the text:
{fields}

Text:
{content}

Return as JSON:`
  ),
]);

// General text generation prompt
export const textGenerationPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(`{systemPrompt}`),
  HumanMessagePromptTemplate.fromTemplate(`{prompt}`),
]);

// Chat prompt for conversational interactions
export const chatPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a helpful legal assistant for a law firm management platform.
Assist users with questions about cases, documents, and legal matters.
Be concise but thorough. Always maintain confidentiality.
Current context: {context}`
  ),
  HumanMessagePromptTemplate.fromTemplate('{message}'),
]);

// Get prompt by operation type
export function getPromptForOperation(operationType: string): ChatPromptTemplate {
  switch (operationType) {
    case 'document_summary':
      return documentSummaryPrompt;
    case 'legal_analysis':
      return legalAnalysisPrompt;
    case 'classification':
      return classificationPrompt;
    case 'extraction':
      return extractionPrompt;
    case 'chat':
      return chatPrompt;
    case 'text_generation':
    default:
      return textGenerationPrompt;
  }
}
