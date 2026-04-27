export const NEW_HERE_INTERNAL_FORM_MODE = 1; // 0 = deshabilitado, 1 = habilitado
export const NEW_HERE_EXTERNAL_URL = 'https://tu-enlace-personalizado.com'; // Formulario externo (si no se usa el interno)
export const NEW_HERE_FORM_SECTION_ID = 'formulario-nuevo';

// url de envio del formulario.
export const NEW_HERE_FORM_SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbyKmcB3KoRjPvOl52r5quLejL7tmoq2xDALTskf3SeP0XYC751wqMfZZ7IDgvkxG-_YFQ/exec';

export type NewHereQuestionType = 'text' | 'tel' | 'email' | 'textarea';
export type NewHereQuestionLayout = 'half' | 'full';

export interface NewHereQuestion {
  id: string;
  name: string;
  label: string;
  type: NewHereQuestionType;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  autoComplete?: string;
  rows?: number;
  layout?: NewHereQuestionLayout;
}

// Editar preguntas del formulario aquí:
export const NEW_HERE_FORM_QUESTIONS: NewHereQuestion[] = [
  {
    id: 'first-name',
    name: 'firstName',
    label: 'Nombre',
    type: 'text',
    required: true,
    placeholder: 'Nombre',
    autoComplete: 'given-name',
    layout: 'half',
  },
  {
    id: 'last-name',
    name: 'lastName',
    label: 'Apellidos',
    type: 'text',
    required: true,
    placeholder: 'Apellidos',
    autoComplete: 'family-name',
    layout: 'half',
  },
  {
    id: 'phone',
    name: 'phone',
    label: 'Numero de contacto / Telefono',
    type: 'tel',
    required: true,
    placeholder: '300 000 0000',
    autoComplete: 'tel',
    layout: 'full',
  },
  {
    id: 'email',
    name: 'email',
    label: 'Correo electronico',
    type: 'email',
    placeholder: 'nombre@correo.com',
    autoComplete: 'email',
    layout: 'full',
  },
  {
    id: 'prayer-request',
    name: 'prayerRequest',
    label: 'Escribe aqui tu peticion de oracion',
    type: 'textarea',
    placeholder: 'Queremos orar contigo. Cuentanos como podemos apoyarte.',
    rows: 6,
    layout: 'full',
  },
];

export function isInternalNewHereFormEnabled() {
  return NEW_HERE_INTERNAL_FORM_MODE === 1;
}
