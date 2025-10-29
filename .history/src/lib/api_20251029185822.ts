const API_BASE_URL = 'https://lamar-backend-api.onrender.com/api';

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
}

export interface PatientOrderResponse {
  message: string;
  patient_id: number;
  order_id: number;
}

export interface ApiError {
  message: string;
  detail?: string;
}

export async function createPatientOrder(
  payload: PatientOrderPayload
): Promise<PatientOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/patients/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      message: data.message || data.detail || 'Failed to create patient order',
      detail: data.detail,
    };
    throw error;
  }

  return data as PatientOrderResponse;
}

