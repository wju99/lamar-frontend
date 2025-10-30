import { useState } from 'react';
import { createPatientOrder, type PatientOrderPayload, type ApiError, type ConfirmationError } from '@/lib/api';
import { toast } from 'sonner';

interface UseCreatePatientOrderReturn {
  mutate: (payload: PatientOrderPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  confirmationError: ConfirmationError | null;
  setConfirmationError: (error: ConfirmationError | null) => void;
}

export function useCreatePatientOrder(): UseCreatePatientOrderReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<ConfirmationError | null>(null);

  const mutate = async (payload: PatientOrderPayload) => {
    setIsLoading(true);
    setError(null);
    setConfirmationError(null);

    try {
      const response = await createPatientOrder(payload);
      toast.success('Care plan input saved successfully.', {
        description: `Patient ID: ${response.patient_id}, Order ID: ${response.order_id}`,
      });
    } catch (err) {
      const apiError = err as ApiError;
      
      // Check if this is a confirmation-required error with issues
      if (apiError.detail && typeof apiError.detail === 'object' && !Array.isArray(apiError.detail)) {
        const confirmationErr = apiError.detail as ConfirmationError;
        if (confirmationErr.requires_confirmation && confirmationErr.issues) {
          // Set confirmation error instead of regular error - this will trigger modal
          console.log('Setting confirmation error in hook:', confirmationErr);
          setConfirmationError(confirmationErr);
          setIsLoading(false);
          return; // Don't throw, just return so modal can be shown
        }
      }
      
      console.log('API error but not confirmation error:', apiError);
      
      // Ensure errorMessage is always a string
      let errorMessage = 'An error occurred while submitting the form.';
      
      if (apiError && apiError.message && typeof apiError.message === 'string') {
        errorMessage = apiError.message;
      } else if (typeof apiError === 'string') {
        errorMessage = apiError;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Normalize error message for comparison
      const normalizedMessage = errorMessage.toLowerCase();
      
      // Check for duplicate errors (MRN, or other unique constraints)
      if (
        normalizedMessage.includes('duplicate') ||
        normalizedMessage.includes('already exists') ||
        normalizedMessage.includes('mrn')
      ) {
        toast.error('Duplicate Entry Detected', {
          description: errorMessage.includes('MRN') 
            ? errorMessage 
            : `A record with this information already exists. ${errorMessage}`,
          duration: 6000,
        });
      } else if (
        normalizedMessage.includes('network error') ||
        normalizedMessage.includes('endpoint not found')
      ) {
        toast.error('Connection Error', {
          description: errorMessage,
          duration: 6000,
        });
      } else if (normalizedMessage.includes('validation error')) {
        toast.error('Validation Error', {
          description: errorMessage,
          duration: 6000,
        });
      } else {
        toast.error('Submission Failed', {
          description: errorMessage,
          duration: 5000,
        });
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error, confirmationError, setConfirmationError };
}

