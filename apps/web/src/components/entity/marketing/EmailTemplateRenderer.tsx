import React from 'react';

interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'form' | 'button' | 'divider' | 'spacer';
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface EmailTemplateSchema {
  blocks: EmailBlock[];
  globalStyles?: {
    backgroundColor?: string;
    fontFamily?: string;
    maxWidth?: string;
    margin?: string;
    [key: string]: any;
  };
}

interface EmailTemplateRendererProps {
  template: {
    name: string;
    subject: string;
    from_name?: string;
    from_email?: string;
    preview_text?: string;
    template_schema: EmailTemplateSchema;
  };
}

/**
 * Email Template Renderer
 *
 * Renders email templates exactly as they would appear in an email client.
 * Uses HTML5 and inline styles compatible with email rendering.
 */
export function EmailTemplateRenderer({ template }: EmailTemplateRendererProps) {
  const { template_schema } = template;
  const globalStyles = template_schema.globalStyles || {};

  const renderBlock = (block: EmailBlock) => {
    const blockStyles = {
      ...block.styles,
      boxSizing: 'border-box' as const,
    };

    switch (block.type) {
      case 'text':
        return (
          <div
            key={block.id}
            style={blockStyles}
            dangerouslySetInnerHTML={{ __html: block.content || '' }}
          />
        );

      case 'image':
        return (
          <div key={block.id} style={blockStyles}>
            <img
              src={block.content || ''}
              alt={block.properties?.alt || 'Email image'}
              style={{
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
                ...block.properties,
              }}
            />
          </div>
        );

      case 'button':
        return (
          <div key={block.id} style={{ textAlign: 'center', padding: '20px', ...blockStyles }}>
            <a
              href={block.properties?.href || '#'}
              target={block.properties?.target || '_self'}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: '500',
                ...blockStyles,
              }}
            >
              {block.content}
            </a>
          </div>
        );

      case 'form':
        return (
          <div
            key={block.id}
            style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center',
              ...blockStyles,
            }}
          >
            <div style={{ marginBottom: '12px', fontWeight: '600', color: '#495057' }}>
              {block.properties?.formName || 'Embedded Form'}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '16px' }}>
              This email contains an interactive form
            </div>
            <a
              href={`/public/form/${block.properties?.formId}`}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              Open Form
            </a>
          </div>
        );

      case 'divider':
        return (
          <hr
            key={block.id}
            style={{
              border: 'none',
              borderTop: '1px solid #dee2e6',
              margin: '20px 0',
              ...blockStyles,
            }}
          />
        );

      case 'spacer':
        return (
          <div
            key={block.id}
            style={{
              height: block.properties?.height || '20px',
              ...blockStyles,
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="email-template-preview">
      {/* Email Metadata Header */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">From</div>
            <div className="text-sm text-gray-900">
              {template.from_name || 'Sender Name'}
              {template.from_email && (
                <span className="text-gray-600"> &lt;{template.from_email}&gt;</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Subject</div>
            <div className="text-sm font-medium text-gray-900">{template.subject}</div>
          </div>
        </div>
        {template.preview_text && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Preview Text</div>
            <div className="text-sm text-gray-600">{template.preview_text}</div>
          </div>
        )}
      </div>

      {/* Email Preview Container */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
        {/* Email Client Toolbar (fake for realism) */}
        <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-xs text-gray-600 ml-4">Email Preview</div>
        </div>

        {/* Actual Email Content */}
        <div
          style={{
            backgroundColor: '#f5f5f5',
            padding: '20px',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div
            style={{
              backgroundColor: globalStyles.backgroundColor || '#ffffff',
              maxWidth: globalStyles.maxWidth || '600px',
              margin: globalStyles.margin || '0 auto',
              fontFamily: globalStyles.fontFamily || 'Arial, sans-serif',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {template_schema.blocks.map((block) => renderBlock(block))}
          </div>
        </div>
      </div>

      {/* Block Count Info */}
      <div className="mt-4 text-sm text-gray-500">
        <span className="font-medium">{template_schema.blocks.length}</span> content blocks
      </div>
    </div>
  );
}
