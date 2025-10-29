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
      const errorMessage = apiError.message || 'An error occurred while submitting the form.';
      
      setError(errorMessage);
      
      // Check for duplicate errors
      if (
        errorMessage.toLowerCase().includes('duplicate') ||
        errorMessage.toLowerCase().includes('already exists')
      ) {
        toast.error('Duplicate Entry Detected', {
          description: errorMessage,
        });
      } else {
        toast.error('Submission Failed', {
          description: errorMessage,
        });
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
}

