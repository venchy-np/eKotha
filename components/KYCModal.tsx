import React, { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { db } from '../services/db';

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

const KYCModal: React.FC<Props> = ({ user, onClose, onSuccess }) => {
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Keep full base64 for storage
        if (type === 'id') setIdImage(base64);
        else setSelfieImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!idImage || !selfieImage) return;

    setIsSubmitting(true);

    // Simulate network delay for manual submission
    setTimeout(() => {
        const updatedUser = db.submitKYC(user.id, idImage, selfieImage);
        if (updatedUser) {
            onSuccess(updatedUser);
        }
        setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-brandGray rounded-none w-full max-w-md p-6 relative shadow-2xl border-2 border-brandYellow">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-2 text-brandBlack dark:text-brandYellow uppercase tracking-wider">KYC Verification</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Upload your documents for manual verification by our team.
        </p>

        <div className="space-y-6">
          {/* ID Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">
              1. Government ID
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${idImage ? 'border-brandYellow bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-400 hover:border-brandYellow dark:border-gray-600'}`}
            >
              {idImage ? (
                <div className="flex flex-col items-center text-brandYellow">
                  <CheckCircle size={32} />
                  <span className="mt-2 text-sm font-bold text-black dark:text-white">ID Uploaded</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500 hover:text-brandYellow transition-colors">
                  <Upload size={32} />
                  <span className="mt-2 text-sm font-bold">Upload Citizenship / License</span>
                </div>
              )}
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => handleFileChange(e, 'id')} 
              />
            </div>
          </div>

          {/* Selfie Camera */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">
              2. Live Selfie
            </label>
            <div 
              onClick={() => cameraInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${selfieImage ? 'border-brandYellow bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-400 hover:border-brandYellow dark:border-gray-600'}`}
            >
               {selfieImage ? (
                <div className="flex flex-col items-center text-brandYellow">
                  <CheckCircle size={32} />
                  <span className="mt-2 text-sm font-bold text-black dark:text-white">Selfie Taken</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500 hover:text-brandYellow transition-colors">
                  <Camera size={32} />
                  <span className="mt-2 text-sm font-bold">Take a Selfie</span>
                </div>
              )}
              <input 
                ref={cameraInputRef} 
                type="file" 
                accept="image/*" 
                capture="user"
                className="hidden" 
                onChange={(e) => handleFileChange(e, 'selfie')} 
              />
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-black/30 p-3 rounded text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
             <AlertCircle size={16} className="shrink-0 mt-0.5" />
             <p>Your documents will be securely stored and manually reviewed by our admins. Verification may take up to 24 hours.</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!idImage || !selfieImage || isSubmitting}
            className="w-full py-4 bg-brandYellow text-brandBlack rounded-none font-bold hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 uppercase tracking-wide shadow-lg"
          >
            {isSubmitting ? "Uploading Documents..." : "Submit for Verification"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KYCModal;