import React from 'react';
import { EmailTemplateRenderer } from '../EmailTemplateRenderer';

interface EmailPreviewPanelProps {
  template: {
    id: string;
    name: string;
    subject: string;
    template_schema: any;
    from_name?: string;
    from_email?: string;
    preview_text?: string;
  };
}

export function EmailPreviewPanel({ template }: EmailPreviewPanelProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <EmailTemplateRenderer template={template} />
    </div>
  );
}
