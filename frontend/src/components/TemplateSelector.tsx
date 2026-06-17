import React from "react";
import { listTemplates } from "../services/templates";
import "../styles/TemplateSelector.css";

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect }) => {
  const templates = listTemplates();

  return (
    <div className="template-selector-overlay">
      <div className="template-selector">
        <h2>Create New Sandbox</h2>
        <p>Choose a framework to get started</p>

        <div className="templates-grid">
          {templates.map((template) => (
            <button key={template.id} className="template-card" onClick={() => onSelect(template.id)}>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;
