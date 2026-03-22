import { useState, useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

interface UploadSectionProps {
  uploadedImage: string | null;
  onImageUpload: (image: string) => void;
  onImageRemove: () => void;
  category: string;
  onCategoryChange: (category: string) => void;
  fields: string[];
  onFieldsChange: (fields: string[]) => void;
}

const DEFAULT_FIELDS = ['company', 'date', 'address', 'total'];
const OPTIONAL_FIELDS = ['phone_number', 'tax', 'invoice_number', 'payment_method'];

export function UploadSection({
  uploadedImage,
  onImageUpload,
  onImageRemove,
  category,
  onCategoryChange,
  fields,
  onFieldsChange,
}: UploadSectionProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageUpload(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageUpload(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeField = (field: string) => {
    onFieldsChange(fields.filter(f => f !== field));
  };

  const addField = (field: string) => {
    if (!fields.includes(field)) {
      onFieldsChange([...fields, field]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Upload Document</Label>
        {uploadedImage ? (
          <Card className="relative overflow-hidden group">
            <img
              src={uploadedImage}
              alt="Uploaded document"
              className="w-full h-auto max-h-96 object-contain"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="destructive"
                size="sm"
                onClick={onImageRemove}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          </Card>
        ) : (
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-12 transition-all
              ${dragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
              }
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base font-medium mb-1">
                Drop your document here
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <ImageIcon className="h-3 w-3" />
                <span>Supports JPG, PNG</span>
              </div>
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/*"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Document Type</Label>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="receipt">Receipt</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="bank_statement">Bank Statement</SelectItem>
            <SelectItem value="menu">Menu</SelectItem>
            <SelectItem value="bill">Bill</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fields Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Fields to Extract</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {fields.map((field) => (
            <Badge
              key={field}
              variant="secondary"
              className="px-3 py-1.5 text-sm hover:bg-secondary/80 transition-colors"
            >
              {field}
              <button
                className="ml-2 hover:text-destructive transition-colors"
                onClick={() => removeField(field)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        {OPTIONAL_FIELDS.filter(f => !fields.includes(f)).length > 0 && (
          <Select onValueChange={addField}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="+ Add optional field" />
            </SelectTrigger>
            <SelectContent>
              {OPTIONAL_FIELDS.filter(f => !fields.includes(f)).map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
