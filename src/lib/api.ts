// Get API base URL - automatically use localhost backend when running on localhost:5173
const getApiBaseUrl = (): string => {
  // Check if we're running on localhost (development)
  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';
  
  if (isLocalhost) {
    // Use local backend for local development
    return 'http://localhost:8000/api';
  }
  
  // For production, use environment variable or fallback to production URL
  return (import.meta.env.VITE_API_BASE_URL || 'https://lamar-backend-api.onrender.com') + '/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface PatientOrderPayload {
  first_name: string;
  last_name: string;
  referring_provider: string;
  provider_npi: string;
  mrn: string;
  primary_diagnosis: string;
  additional_diagnoses?: string[];
  medication_name: string;
  medication_history?: string[];
  records_text: string;
  confirm_patient_name_mismatch?: boolean;
  confirm_provider_name_mismatch?: boolean;
  confirm_duplicate_order?: boolean;
}

export interface PatientOrderResponse {
  message: string;
  patient_id: number;
  order_id: number;
}

export async function downloadCarePlan(
  patientId: number,
  orderId: number
): Promise<Blob> {
  const API_BASE_URL =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:8000/api'
      : import.meta.env.VITE_API_BASE_URL || 'https://lamar-backend-api.onrender.com/api';

  const response = await fetch(
    `${API_BASE_URL}/patients/${patientId}/orders/${orderId}/care-plan`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to generate care plan';
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    const error: ApiError = {
      message: errorMessage,
      detail: errorText,
    };
    throw error;
  }

  // Return the blob for download
  return await response.blob();
}

export interface ValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
}

export interface ApiError {
  message: string;
  detail?: string | ValidationError[] | ConfirmationError;
}

export interface ConfirmationIssues {
  patient?: {
    existing_name: string;
    submitted_name: string;
    mrn: string;
  };
  provider?: {
    existing_name: string;
    submitted_name: string;
    npi: string;
  };
  order?: {
    medication_name: string;
    existing_order_id: number;
  };
}

export interface ConfirmationError {
  requires_confirmation: boolean;
  issues: ConfirmationIssues;
}


export async function createPatientOrder(
  payload: PatientOrderPayload
): Promise<PatientOrderResponse> {
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchError) {
    // Handle network errors (CORS, connection refused, etc.)
    const error: ApiError = {
      message: 'Network error: Unable to reach the server. Please check your connection and ensure the API is running.',
      detail: fetchError instanceof Error ? fetchError.message : 'Unknown network error',
    };
    throw error;
  }

  // Check content type before parsing JSON
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  
  let data: PatientOrderResponse | { 
    message?: string; 
    detail?: string | ValidationError[] | ConfirmationError;
    requires_confirmation?: boolean;
    issues?: ConfirmationIssues;
  };
  
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      const error: ApiError = {
        message: 'Invalid JSON response from server',
        detail: 'The server returned an unexpected format.',
      };
      throw error;
    }
  } else {
    // Server returned HTML or other non-JSON content (likely a 404 page)
    await response.text(); // Consume the response body
    let errorMessage = `Server error (${response.status}): ${response.statusText}`;
    
    if (response.status === 404) {
      errorMessage = 'API endpoint not found. Please verify the API URL is correct and the server is running.';
    } else if (response.status >= 500) {
      errorMessage = 'Server error. Please try again later or contact support.';
    }
    
    const error: ApiError = {
      message: errorMessage,
      detail: `Received ${contentType || 'unknown content type'} instead of JSON`,
    };
    throw error;
  }

  if (!response.ok) {
    // At this point, data is JSON but contains error information
    console.log('Response not OK. Status:', response.status, 'Data:', data);
    
    const errorData = data as {
      message?: string;
      detail?: string | ValidationError[] | ConfirmationError;
      requires_confirmation?: boolean;
      issues?: ConfirmationIssues;
    };

    let errorMessage = '';
    let errorDetail: string | ValidationError[] | ConfirmationError | undefined;

    // Handle Django Ninja validation errors (422)
    if (response.status === 422) {
      console.log('422 status. Checking errorData:', errorData);
      console.log('requires_confirmation:', errorData.requires_confirmation, 'issues:', errorData.issues);
      
      // Check if this is a confirmation-required error with issues (JsonResponse format)
      if (errorData.requires_confirmation && errorData.issues) {
        const confirmationError: ConfirmationError = {
          requires_confirmation: true,
          issues: errorData.issues
        };
        errorDetail = confirmationError;
        errorMessage = 'Confirmation required before proceeding';
        
        console.log('Confirmation error detected:', confirmationError);
        
        const error: ApiError = {
          message: errorMessage,
          detail: errorDetail,
        };
        throw error;
      }
      
      console.log('422 response but not confirmation error. errorData:', errorData);
      
      // Check if this is a confirmation-required error in detail field (HttpError format - legacy)
      if (typeof errorData.detail === 'object' && errorData.detail !== null && !Array.isArray(errorData.detail)) {
        const confirmationError = errorData.detail as ConfirmationError;
        if (confirmationError.requires_confirmation && confirmationError.issues) {
          // This is a confirmation-required error
          errorDetail = confirmationError;
          errorMessage = 'Confirmation required before proceeding';
          
          const error: ApiError = {
            message: errorMessage,
            detail: errorDetail,
          };
          throw error;
        }
      }
      
      if (Array.isArray(errorData.detail)) {
        // Format validation errors into a readable message
        const validationErrors = errorData.detail
          .map((err: ValidationError) => {
            const field = err.loc.slice(1).join('.');
            return `${field}: ${err.msg}`;
          })
          .join('; ');
        errorMessage = `Validation error: ${validationErrors}`;
        errorDetail = errorData.detail;
      } else if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
        errorDetail = errorData.detail;
      }
    } else if (response.status === 400) {
      // Handle 400 Bad Request errors (e.g., duplicate MRN, IntegrityError)
      // Django Ninja HttpError returns the message in "detail" field
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
        errorDetail = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
        errorDetail = errorData.message;
      } else {
        errorMessage = 'Bad request. Please check your input.';
      }
    } else if (typeof errorData.detail === 'string') {
      errorMessage = errorData.message || errorData.detail;
      errorDetail = errorData.detail;
    } else if (errorData.message) {
      errorMessage = errorData.message;
    } else {
      errorMessage = `Request failed with status ${response.status}`;
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }

    const error: ApiError = {
      message: errorMessage,
      detail: errorDetail,
    };
    throw error;
  }

  return data as PatientOrderResponse;
}

