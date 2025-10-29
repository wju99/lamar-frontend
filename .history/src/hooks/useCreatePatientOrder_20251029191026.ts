import { useState } from 'react';
import { createPatientOrder, type PatientOrderPayload, type ApiError } from '@/lib/api';
import { toast } from 'sonner';

interface UseCreatePatientOrderReturn {
  mutate: (payload: PatientOrderPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useCreatePatientOrder(): UseCreatePatientOrderReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (payload: PatientOrderPayload) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await createPatientOrder(payload);
      toast.success('Care plan input saved successfully.', {
        description: `Patient ID: ${response.patient_id}, Order ID: ${response.order_id}`,
      });
    } catch (err) {
      const apiError = err as ApiError;
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
      
      // Check for duplicate errors
      if (
        normalizedMessage.includes('duplicate') ||
        normalizedMessage.includes('already exists')
      ) {
        toast.error('Duplicate Entry Detected', {
          description: errorMessage,
          duration: 5000,
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

  return { mutate, isLoading, error };
}

