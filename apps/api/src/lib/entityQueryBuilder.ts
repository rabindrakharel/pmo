import { sql } from 'drizzle-orm';
import { Type } from '@sinclair/typebox';
import { ENTITY_CONFIG, type EntityConfig, type FieldConfig } from './entityConfig.js';

/**
 * Entity Query Builder
 * 
 * Generates SQL queries and TypeBox schemas dynamically from EntityConfig
 * Provides consistent database operations across all entities
 */
export class EntityQueryBuilder {
  private config: EntityConfig;

  constructor(private entityName: string) {
    const config = ENTITY_CONFIG[entityName];
    if (!config) {
      throw new Error(`Entity config not found for: ${entityName}`);
    }
    this.config = config;
  }

  // ==========================================================================
  // Data Transformation Methods
  // ==========================================================================

  /**
   * Convert API request data to database column format
   */
  apiToDdl(apiData: Record<string, any>): Record<string, any> {
    const ddlData: Record<string, any> = {};
    
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      const apiValue = apiData[fieldConfig.apiField];
      
      if (apiValue !== undefined) {
        // Handle special type conversions
        ddlData[fieldConfig.ddlColumn] = this.convertApiToDbValue(apiValue, fieldConfig);
      }
    });
    
    return ddlData;
  }

  /**
   * Convert database result to API response format
   */
  ddlToApi(ddlData: Record<string, any>): Record<string, any> {
    const apiData: Record<string, any> = {};
    
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      const ddlValue = ddlData[fieldConfig.ddlColumn];
      
      if (ddlValue !== undefined) {
        // Handle special type conversions
        apiData[fieldConfig.apiField] = this.convertDbToApiValue(ddlValue, fieldConfig);
      }
    });
    
    return apiData;
  }

  /**
   * Convert multiple database results to API format
   */
  ddlArrayToApi(ddlArray: Record<string, any>[]): Record<string, any>[] {
    return ddlArray.map(ddlData => this.ddlToApi(ddlData));
  }

  // ==========================================================================
  // SQL Query Generation Methods  
  // ==========================================================================

  /**
   * Generate SELECT statement with proper field mapping
   */
  generateSelect(conditions: any[] = [], options: {
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  } = {}) {
    const selectFields = this.getSelectFields();
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    let orderClause = sql``;
    if (options.orderBy) {
      const orderField = this.getDbColumnName(options.orderBy) || options.orderBy;
      const direction = options.orderDirection || 'ASC';
      orderClause = sql`ORDER BY ${sql.raw(orderField)} ${sql.raw(direction)}`;
    }
    
    let limitClause = sql``;
    if (options.limit) {
      limitClause = sql`LIMIT ${options.limit}`;
      if (options.offset) {
        limitClause = sql`LIMIT ${options.limit} OFFSET ${options.offset}`;
      }
    }

    return sql`
      SELECT ${selectFields}
      FROM ${sql.raw(this.config.table)}
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;
  }

  /**
   * Generate COUNT query for pagination
   */
  generateCount(conditions: any[] = []) {
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    
    return sql`
      SELECT COUNT(*) as total
      FROM ${sql.raw(this.config.table)}
      ${whereClause}
    `;
  }

  /**
   * Generate INSERT statement
   */
  generateInsert(data: Record<string, any>) {
    const ddlData = this.apiToDdl(data);
    
    // Filter out generated fields and undefined values
    const insertData: Record<string, any> = {};
    Object.entries(ddlData).forEach(([column, value]) => {
      if (value !== undefined) {
        // Check if this column corresponds to a generated field
        const isGenerated = Object.values(this.config.fields).some(
          field => field.ddlColumn === column && field.generated
        );
        if (!isGenerated) {
          insertData[column] = value;
        }
      }
    });

    const columns = Object.keys(insertData);
    const values = Object.values(insertData);
    
    return sql`
      INSERT INTO ${sql.raw(this.config.table)} 
      (${sql.join(columns.map(col => sql.raw(`"${col}"`)), sql`, `)})
      VALUES (${sql.join(values.map(val => sql`${val}`), sql`, `)})
      RETURNING ${this.getSelectFields()}
    `;
  }

  /**
   * Generate UPDATE statement
   */
  generateUpdate(id: string, data: Record<string, any>) {
    const ddlData = this.apiToDdl(data);
    
    // Filter out generated fields, primary key, and undefined values
    const updateData: Record<string, any> = {};
    Object.entries(ddlData).forEach(([column, value]) => {
      if (value !== undefined && column !== this.config.primaryKey) {
        const isGenerated = Object.values(this.config.fields).some(
          field => field.ddlColumn === column && (field.generated || field.hidden)
        );
        if (!isGenerated) {
          updateData[column] = value;
        }
      }
    });

    // Always update the 'updated' timestamp if it exists
    if (this.hasField('updated')) {
      updateData['updated'] = sql`NOW()`;
    }

    const setClause = Object.entries(updateData).map(([column, value]) => {
      return value === sql`NOW()` ? 
        sql.raw(`"${column}" = NOW()`) : 
        sql.raw(`"${column}" = ${value}`);
    });
    
    return sql`
      UPDATE ${sql.raw(this.config.table)}
      SET ${sql.join(setClause, sql`, `)}
      WHERE ${sql.raw(`"${this.config.primaryKey}"`)} = ${id}
      RETURNING ${this.getSelectFields()}
    `;
  }

  /**
   * Generate DELETE statement (soft delete if has active field, otherwise hard delete)
   */
  generateDelete(id: string) {
    if (this.hasField('active')) {
      // Soft delete
      const updateFields = [sql.raw(`"active" = false`)];
      
      if (this.hasField('to_ts')) {
        updateFields.push(sql.raw(`"to_ts" = NOW()`));
      }
      
      if (this.hasField('updated')) {
        updateFields.push(sql.raw(`"updated" = NOW()`));
      }
      
      return sql`
        UPDATE ${sql.raw(this.config.table)}
        SET ${sql.join(updateFields, sql`, `)}
        WHERE ${sql.raw(`"${this.config.primaryKey}"`)} = ${id}
        RETURNING ${this.getSelectFields()}
      `;
    } else {
      // Hard delete
      return sql`
        DELETE FROM ${sql.raw(this.config.table)}
        WHERE ${sql.raw(`"${this.config.primaryKey}"`)} = ${id}
      `;
    }
  }

  // ==========================================================================
  // Search and Filter Methods
  // ==========================================================================

  /**
   * Generate search conditions for text fields
   */
  generateSearchConditions(searchTerm: string): any[] {
    if (!searchTerm || !this.config.listView?.searchFields) {
      return [];
    }

    const searchConditions = this.config.listView.searchFields.map(fieldName => {
      const fieldConfig = this.config.fields[fieldName];
      if (!fieldConfig) return null;
      
      const column = fieldConfig.ddlColumn;
      return sql.raw(`"${column}" ILIKE '%${searchTerm}%'`);
    }).filter(Boolean);

    return searchConditions.length > 0 ? [sql`(${sql.join(searchConditions, sql` OR `)})`] : [];
  }

  /**
   * Generate filter conditions
   */
  generateFilterConditions(filters: Record<string, any>): any[] {
    const conditions: any[] = [];

    Object.entries(filters).forEach(([apiField, value]) => {
      if (value === undefined || value === null) return;

      const fieldConfig = Object.values(this.config.fields).find(
        field => field.apiField === apiField
      );
      
      if (!fieldConfig) return;

      const column = fieldConfig.ddlColumn;
      
      if (Array.isArray(value)) {
        // IN condition for arrays
        conditions.push(sql.raw(`"${column}" = ANY(${value})`));
      } else if (fieldConfig.type === 'boolean') {
        conditions.push(sql.raw(`"${column}" = ${value}`));
      } else if (fieldConfig.type === 'string') {
        if (value.includes('%') || value.includes('_')) {
          conditions.push(sql.raw(`"${column}" LIKE '${value}'`));
        } else {
          conditions.push(sql.raw(`"${column}" = '${value}'`));
        }
      } else {
        conditions.push(sql.raw(`"${column}" = ${value}`));
      }
    });

    return conditions;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private getSelectFields() {
    return sql.join(
      Object.entries(this.config.fields)
        .filter(([_, fieldConfig]) => !fieldConfig.hidden)
        .map(([_, fieldConfig]) => 
          sql.raw(`"${fieldConfig.ddlColumn}" as "${fieldConfig.apiField}"`)
        ), 
      sql`, `
    );
  }

  private hasField(apiFieldName: string): boolean {
    return Object.values(this.config.fields).some(
      field => field.apiField === apiFieldName
    );
  }

  private getDbColumnName(apiFieldName: string): string | null {
    const fieldConfig = Object.values(this.config.fields).find(
      field => field.apiField === apiFieldName
    );
    return fieldConfig ? fieldConfig.ddlColumn : null;
  }

  private convertApiToDbValue(value: any, fieldConfig: FieldConfig): any {
    switch (fieldConfig.type) {
      case 'array':
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value);
      case 'boolean':
        return Boolean(value);
      case 'number':
        return Number(value);
      case 'date':
      case 'datetime':
        return value instanceof Date ? value.toISOString() : value;
      default:
        return value;
    }
  }

  private convertDbToApiValue(value: any, fieldConfig: FieldConfig): any {
    switch (fieldConfig.type) {
      case 'array':
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'boolean':
        return Boolean(value);
      case 'number':
        return Number(value);
      case 'date':
        return value instanceof Date ? value.toISOString().split('T')[0] : value;
      case 'datetime':
        return value instanceof Date ? value.toISOString() : value;
      default:
        return value;
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get tableName(): string {
    return this.config.table;
  }

  get primaryKeyColumn(): string {
    return this.config.primaryKey;
  }

  get entityDisplayName(): string {
    return this.config.displayName;
  }

  get apiEndpoint(): string {
    return this.config.apiEndpoint;
  }

  get allFields(): Record<string, FieldConfig> {
    return this.config.fields;
  }

  get createFields(): Record<string, FieldConfig> {
    const fields: Record<string, FieldConfig> = {};
    Object.entries(this.config.fields).forEach(([fieldName, fieldConfig]) => {
      if (!fieldConfig.generated && !fieldConfig.hidden) {
        fields[fieldName] = fieldConfig;
      }
    });
    return fields;
  }

  get displayFields(): string[] {
    return this.config.listView?.displayFields || 
           Object.keys(this.config.fields).slice(0, 5);
  }
}