#!/usr/bin/env node

/**
 * GraphQL Schema Documentation Generator
 * Story 2.7: API Documentation and Developer Portal
 *
 * This script generates markdown documentation from GraphQL schema files.
 * It loads all .graphql files from the schema directory and creates
 * comprehensive documentation in docs/api/schema/
 */

const fs = require('fs');
const path = require('path');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { printSchema, buildSchema, introspectionFromSchema } = require('graphql');

// Paths
const SCHEMA_DIR = path.join(__dirname, '../src/graphql/schema');
const OUTPUT_DIR = path.join(__dirname, '../../../docs/api/schema');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'schema.md');

console.log('🔍 Loading GraphQL schema files...');

try {
  // Load all .graphql files
  const typeDefs = loadFilesSync(path.join(SCHEMA_DIR, '**/*.graphql'), {
    recursive: true,
  });

  console.log(`✅ Loaded ${typeDefs.length} schema file(s)`);

  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
  });

  // Generate schema SDL
  const schemaSDL = printSchema(schema);

  // Generate markdown documentation
  const markdown = generateMarkdown(schema, schemaSDL);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write documentation
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8');

  console.log(`✅ Generated documentation: ${OUTPUT_FILE}`);
  console.log('📚 Documentation generation complete!');
} catch (error) {
  console.error('❌ Error generating documentation:', error.message);
  process.exit(1);
}

/**
 * Generate markdown documentation from GraphQL schema
 */
function generateMarkdown(schema, schemaSDL) {
  const introspection = introspectionFromSchema(schema);
  const types = introspection.__schema.types.filter((type) => !type.name.startsWith('__'));

  let markdown = `# GraphQL API Schema Documentation

> **Auto-generated documentation** from GraphQL schema files
> Last updated: ${new Date().toISOString()}

---

## Table of Contents

- [Overview](#overview)
- [Scalars](#scalars)
- [Enums](#enums)
- [Types](#types)
- [Input Types](#input-types)
- [Queries](#queries)
- [Mutations](#mutations)
- [Full Schema SDL](#full-schema-sdl)

---

## Overview

This document provides comprehensive documentation for the Legal Platform GraphQL API.
The API uses GraphQL for flexible data fetching and includes built-in authentication
and authorization controls.

**Key Features:**
- 🔐 Authentication via Azure AD OAuth 2.0
- 🏢 Multi-tenant firm isolation
- 📝 Comprehensive audit logging
- 🔍 Full-text search capabilities
- ⚡ Real-time introspection in development

---

`;

  // Scalars
  const scalars = types.filter((t) => t.kind === 'SCALAR');
  if (scalars.length > 0) {
    markdown += '## Scalars\n\n';
    markdown += 'Custom scalar types used in the API.\n\n';
    scalars.forEach((scalar) => {
      markdown += `### ${scalar.name}\n\n`;
      if (scalar.description) {
        markdown += `${scalar.description}\n\n`;
      }
    });
    markdown += '---\n\n';
  }

  // Enums
  const enums = types.filter((t) => t.kind === 'ENUM');
  if (enums.length > 0) {
    markdown += '## Enums\n\n';
    markdown += 'Enumeration types representing fixed sets of values.\n\n';
    enums.forEach((enumType) => {
      markdown += `### ${enumType.name}\n\n`;
      if (enumType.description) {
        markdown += `${enumType.description}\n\n`;
      }
      if (enumType.enumValues && enumType.enumValues.length > 0) {
        markdown += '**Values:**\n\n';
        enumType.enumValues.forEach((value) => {
          markdown += `- \`${value.name}\``;
          if (value.description) {
            markdown += ` - ${value.description}`;
          }
          if (value.isDeprecated) {
            markdown += ` ⚠️ **DEPRECATED**`;
            if (value.deprecationReason) {
              markdown += `: ${value.deprecationReason}`;
            }
          }
          markdown += '\n';
        });
        markdown += '\n';
      }
    });
    markdown += '---\n\n';
  }

  // Object Types
  const objects = types.filter(
    (t) =>
      t.kind === 'OBJECT' &&
      t.name !== 'Query' &&
      t.name !== 'Mutation' &&
      t.name !== 'Subscription'
  );
  if (objects.length > 0) {
    markdown += '## Types\n\n';
    markdown += 'Object types representing entities in the system.\n\n';
    objects.forEach((obj) => {
      markdown += `### ${obj.name}\n\n`;
      if (obj.description) {
        markdown += `${obj.description}\n\n`;
      }
      if (obj.fields && obj.fields.length > 0) {
        markdown += '**Fields:**\n\n';
        markdown += '| Field | Type | Description |\n';
        markdown += '|-------|------|-------------|\n';
        obj.fields.forEach((field) => {
          const fieldType = formatType(field.type);
          const description = field.description || '-';
          const deprecation = field.isDeprecated
            ? ` ⚠️ DEPRECATED: ${field.deprecationReason || 'No reason provided'}`
            : '';
          markdown += `| \`${field.name}\` | \`${fieldType}\` | ${description}${deprecation} |\n`;
        });
        markdown += '\n';
      }
    });
    markdown += '---\n\n';
  }

  // Input Types
  const inputs = types.filter((t) => t.kind === 'INPUT_OBJECT');
  if (inputs.length > 0) {
    markdown += '## Input Types\n\n';
    markdown += 'Input types used for mutations and complex query arguments.\n\n';
    inputs.forEach((input) => {
      markdown += `### ${input.name}\n\n`;
      if (input.description) {
        markdown += `${input.description}\n\n`;
      }
      if (input.inputFields && input.inputFields.length > 0) {
        markdown += '**Fields:**\n\n';
        markdown += '| Field | Type | Description |\n';
        markdown += '|-------|------|-------------|\n';
        input.inputFields.forEach((field) => {
          const fieldType = formatType(field.type);
          const description = field.description || '-';
          markdown += `| \`${field.name}\` | \`${fieldType}\` | ${description} |\n`;
        });
        markdown += '\n';
      }
    });
    markdown += '---\n\n';
  }

  // Queries
  const queryType = types.find((t) => t.name === 'Query');
  if (queryType && queryType.fields) {
    markdown += '## Queries\n\n';
    markdown += 'Available query operations for fetching data.\n\n';
    queryType.fields.forEach((field) => {
      markdown += `### ${field.name}\n\n`;
      if (field.description) {
        markdown += `${field.description}\n\n`;
      }

      // Arguments
      if (field.args && field.args.length > 0) {
        markdown += '**Arguments:**\n\n';
        markdown += '| Argument | Type | Description |\n';
        markdown += '|----------|------|-------------|\n';
        field.args.forEach((arg) => {
          const argType = formatType(arg.type);
          const description = arg.description || '-';
          markdown += `| \`${arg.name}\` | \`${argType}\` | ${description} |\n`;
        });
        markdown += '\n';
      }

      // Return type
      markdown += `**Returns:** \`${formatType(field.type)}\`\n\n`;

      if (field.isDeprecated) {
        markdown += `⚠️ **DEPRECATED**: ${field.deprecationReason || 'No reason provided'}\n\n`;
      }
    });
    markdown += '---\n\n';
  }

  // Mutations
  const mutationType = types.find((t) => t.name === 'Mutation');
  if (mutationType && mutationType.fields) {
    markdown += '## Mutations\n\n';
    markdown += 'Available mutation operations for modifying data.\n\n';
    mutationType.fields.forEach((field) => {
      markdown += `### ${field.name}\n\n`;
      if (field.description) {
        markdown += `${field.description}\n\n`;
      }

      // Arguments
      if (field.args && field.args.length > 0) {
        markdown += '**Arguments:**\n\n';
        markdown += '| Argument | Type | Description |\n';
        markdown += '|----------|------|-------------|\n';
        field.args.forEach((arg) => {
          const argType = formatType(arg.type);
          const description = arg.description || '-';
          markdown += `| \`${arg.name}\` | \`${argType}\` | ${description} |\n`;
        });
        markdown += '\n';
      }

      // Return type
      markdown += `**Returns:** \`${formatType(field.type)}\`\n\n`;

      if (field.isDeprecated) {
        markdown += `⚠️ **DEPRECATED**: ${field.deprecationReason || 'No reason provided'}\n\n`;
      }
    });
    markdown += '---\n\n';
  }

  // Full Schema SDL
  markdown += '## Full Schema SDL\n\n';
  markdown += 'Complete GraphQL Schema Definition Language representation.\n\n';
  markdown += '```graphql\n';
  markdown += schemaSDL;
  markdown += '\n```\n';

  return markdown;
}

/**
 * Format GraphQL type for display
 */
function formatType(type) {
  if (type.kind === 'NON_NULL') {
    return `${formatType(type.ofType)}!`;
  }
  if (type.kind === 'LIST') {
    return `[${formatType(type.ofType)}]`;
  }
  return type.name;
}
