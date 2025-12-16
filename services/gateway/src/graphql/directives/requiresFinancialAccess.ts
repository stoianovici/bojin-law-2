/**
 * @requiresFinancialAccess Directive
 * Story 2.8.3: Role-Based Financial Visibility
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 *
 * This directive protects financial data fields by restricting access to
 * Partners and BusinessOwners only. Non-authorized users receive `null`
 * for financial fields (graceful degradation).
 *
 * Usage in schema:
 * ```graphql
 * type Case {
 *   value: Float @requiresFinancialAccess
 * }
 * ```
 */

import type { GraphQLFieldConfig } from 'graphql';
import { GraphQLSchema, defaultFieldResolver } from 'graphql';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import type { Context } from '../resolvers/case.resolvers';

/**
 * Directive name
 */
export const DIRECTIVE_NAME = 'requiresFinancialAccess';

/**
 * GraphQL schema definition for the directive
 */
export const requiresFinancialAccessTypeDefs = `
  """
  Restricts access to financial data fields.
  Partners and BusinessOwners can access fields with this directive.
  Non-authorized users receive null (graceful degradation).
  """
  directive @${DIRECTIVE_NAME} on FIELD_DEFINITION
`;

/**
 * Transform schema to apply @requiresFinancialAccess directive logic
 *
 * @param schema - GraphQL schema to transform
 * @returns Transformed schema with financial access controls
 */
export function requiresFinancialAccessDirective(directiveName: string = DIRECTIVE_NAME) {
  return (schema: GraphQLSchema): GraphQLSchema => {
    return mapSchema(schema, {
      // Apply to object field definitions
      [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<any, Context>) => {
        // Check if field has the directive
        const directive = getDirective(schema, fieldConfig, directiveName)?.[0];

        if (directive) {
          // Get original resolver (or use default)
          const { resolve = defaultFieldResolver } = fieldConfig;

          // Replace with wrapped resolver
          fieldConfig.resolve = async function (source, args, context: Context, info) {
            // Determine if this is a root Query/Mutation field
            const parentType = info.parentType.name;
            const isRootField = parentType === 'Query' || parentType === 'Mutation';

            // Check if user is authenticated
            if (!context.user) {
              logUnauthorizedAccess(context, info.fieldName, 'UNAUTHENTICATED');

              if (isRootField) {
                // Throw error for root Query/Mutation fields
                const { GraphQLError } = await import('graphql');
                throw new GraphQLError('Authentication required', {
                  extensions: { code: 'UNAUTHENTICATED' },
                });
              }

              // Return null for nested object fields (graceful degradation)
              return null;
            }

            // Check if user has financial access (Partner or BusinessOwner)
            // Story 2.11.1: Added BusinessOwner role support
            const hasAccess =
              context.user.role === 'Partner' || context.user.role === 'BusinessOwner';

            if (!hasAccess) {
              logUnauthorizedAccess(context, info.fieldName, context.user.role);

              if (isRootField) {
                // Throw error for root Query/Mutation fields
                const { GraphQLError } = await import('graphql');
                throw new GraphQLError(
                  'Forbidden: This operation requires Partner or BusinessOwner role',
                  {
                    extensions: {
                      code: 'FORBIDDEN',
                      requiredRoles: ['Partner', 'BusinessOwner'],
                      userRole: context.user.role,
                    },
                  }
                );
              }

              // Return null for nested object fields (graceful degradation)
              return null;
            }

            // User has financial access - resolve field normally
            return resolve(source, args, context, info);
          };
        }

        return fieldConfig;
      },
    });
  };
}

/**
 * Log unauthorized access attempts for security monitoring
 *
 * @param context - GraphQL context
 * @param fieldName - Name of the financial field accessed
 * @param userRole - Role of the user attempting access
 */
function logUnauthorizedAccess(context: Context, fieldName: string, userRole: string): void {
  // Log at INFO level (not ERROR - this is expected behavior)
  console.info('Financial data access denied', {
    timestamp: new Date().toISOString(),
    userId: context.user?.id || 'anonymous',
    firmId: context.user?.firmId || null,
    userRole,
    field: fieldName,
    message: `User with role "${userRole}" attempted to access financial field "${fieldName}"`,
  });

  // TODO: When logging service is available, use structured logging:
  // context.logger?.info('Financial data access denied', {
  //   userId: context.user?.id,
  //   firmId: context.user?.firmId,
  //   userRole,
  //   field: fieldName,
  // });
}

/**
 * Check if a user has financial access
 * Utility function for use in resolvers
 * Story 2.11.1: Updated to include BusinessOwner role
 *
 * @param context - GraphQL context
 * @returns true if user has financial access (is Partner or BusinessOwner)
 */
export function hasFinancialAccess(context: Context): boolean {
  return context.user?.role === 'Partner' || context.user?.role === 'BusinessOwner';
}
