import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, CheckCircle, FileText, AlertCircle, Phone, User as UserIcon, MapPin, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { db } from '../services/db';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

const KYCModal: React.FC<Props> = ({ user, onClose, onSuccess }) => {
  const [officialName, setOfficialName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.recaptchaVerifier && recaptchaRef.current) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  }, []);

  const handleSendOtp = async () => {
    if (!phone) {
        setErrorMsg("Please enter a phone number");
        return;
    }
    
    let formattedPhone = phone.trim();
    // Auto-format Nepal numbers starting with 9 and having 10 digits
    if (formattedPhone.length === 10 && formattedPhone.startsWith('9')) {
        formattedPhone = '+977' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }

    setErrorMsg('');
    setIsSendingOtp(true);
    try {
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setVerificationId(confirmationResult);
        setPhone(formattedPhone); // Update input to show formatted number
    } catch (error: any) {
        console.error("SMS error", error);
        if (error.code === 'auth/operation-not-allowed') {
            setErrorMsg("SMS verification is not enabled for this region. Please contact the administrator.");
        } else if (error.code === 'auth/invalid-phone-number') {
            setErrorMsg("Invalid phone number format. Please use international format (e.g., +97798...).");
        } else {
            setErrorMsg(error.message || "Failed to send SMS.");
        }
    } finally {
        setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !verificationId) return;
    setErrorMsg('');
    setIsVerifyingOtp(true);
    try {
        await verificationId.confirm(otp);
        setIsPhoneVerified(true);
    } catch (error: any) {
        console.error("OTP error", error);
        setErrorMsg("Invalid OTP code. Please try again.");
    } finally {
        setIsVerifyingOtp(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (type === 'id') setIdImage(base64);
        else setSelfieImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!idImage || !selfieImage || !officialName || !address || !phone) return;

    setIsSubmitting(true);

    try {
        const updatedUser = await db.submitKYC(user.id, {
            officialName,
            address,
            phone,
            idImage,
            selfieImage
        });
        if (updatedUser) {
            onSuccess(updatedUser);
        }
    } catch (error) {
        console.error("Failed to submit KYC", error);
        setErrorMsg("Failed to submit KYC. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="glass rounded-2xl w-full max-w-lg p-6 relative shadow-2xl border border-brandPrimary my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white tracking-wide">KYC Verification</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Complete your profile for manual verification by our team.
        </p>

        {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-lg flex items-center gap-2">
                <AlertCircle size={16} />
                {errorMsg}
            </div>
        )}

        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
          {/* Personal Info */}
          <div className="space-y-4">
              <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                      <UserIcon size={12}/> Official Full Name
                  </label>
                  <input 
                    value={officialName}
                    onChange={e => setOfficialName(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-brandPrimary transition-all font-bold"
                    placeholder="As per Government ID"
                  />
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                      <MapPin size={12}/> Permanent Address
                  </label>
                  <input 
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-brandPrimary transition-all font-bold"
                    placeholder="City, District, Ward"
                  />
              </div>
          </div>

          {/* Phone Verification */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <Phone size={12}/> Phone Number
            </label>
            <div className="flex gap-2">
                <input 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-brandPrimary transition-all font-bold"
                    placeholder="e.g. 98XXXXXXXX"
                />
                {/* SMS Verification temporarily disabled due to billing constraints
                {!isPhoneVerified && !verificationId && (
                    <button 
                        onClick={handleSendOtp}
                        disabled={isSendingOtp || !phone}
                        className="px-4 bg-brandPrimary text-white font-bold rounded-xl disabled:opacity-50"
                    >
                        {isSendingOtp ? "..." : "Send OTP"}
                    </button>
                )}
                {isPhoneVerified && (
                    <div className="px-4 bg-green-500 text-white font-bold rounded-xl flex items-center gap-1">
                        <CheckCircle size={16} /> Verified
                    </div>
                )}
                */}
            </div>

            {/*
            {verificationId && !isPhoneVerified && (
                <div className="flex gap-2 animate-in slide-in-from-top-2">
                    <input 
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        className="flex-1 p-3 bg-white dark:bg-slate-800 border border-brandPrimary rounded-xl outline-none font-bold"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                    />
                    <button 
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otp.length < 6}
                        className="px-4 bg-brandSecondary text-white font-bold rounded-xl disabled:opacity-50"
                    >
                        {isVerifyingOtp ? "..." : "Verify"}
                    </button>
                </div>
            )}
            */}
          </div>

          <div id="recaptcha-container" ref={recaptchaRef} className="hidden"></div>

          {/* ID Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ">
              Government ID Photo
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${idImage ? 'border-brandPrimary bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-400 hover:border-brandPrimary dark:border-gray-600'}`}
            >
              {idImage ? (
                <div className="flex flex-col items-center text-brandPrimary">
                  <CheckCircle size={32} />
                  <span className="mt-2 text-sm font-bold text-slate-900 dark:text-white">ID Uploaded</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500 hover:text-brandPrimary transition-colors">
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
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ">
              Live Selfie
            </label>
            <div 
              onClick={() => cameraInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${selfieImage ? 'border-brandPrimary bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-400 hover:border-brandPrimary dark:border-gray-600'}`}
            >
               {selfieImage ? (
                <div className="flex flex-col items-center text-brandPrimary">
                  <CheckCircle size={32} />
                  <span className="mt-2 text-sm font-bold text-slate-900 dark:text-white">Selfie Taken</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500 hover:text-brandPrimary transition-colors">
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

          <div className="bg-gray-100 dark:bg-slate-900/30 p-3 rounded text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
             <AlertCircle size={16} className="shrink-0 mt-0.5" />
             <p>Your documents will be securely stored and manually reviewed by our admins. Verification may take up to 24 hours.</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!idImage || !selfieImage || !officialName || !address || !phone || isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-brandPrimary to-brandSecondary text-white rounded-2xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2  tracking-wide shadow-lg"
          >
            {isSubmitting ? "Uploading Documents..." : "Submit for Verification"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KYCModal;

declare global {
    interface Window {
        recaptchaVerifier: any;
    }
}