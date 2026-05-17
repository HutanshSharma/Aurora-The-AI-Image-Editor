export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',
  
  // API endpoints
  ENDPOINTS: {
    INPAINTING: '/inpainting',
    TEXT_EDIT: '/inpainting/text-edit',
    APPLY_EDITS: '/inpainting/apply-edits',
    TASK_STATUS: '/inpainting/status',
    QWEN_WHITE_TO_SCENE: '/inpainting/qwen/white-to-scene',
    QWEN_FUSION: '/inpainting/qwen/fusion',
    QWEN_RELIGHT: '/inpainting/qwen/relight',
    PRESETS: '/inpainting/presets',
    SEGMENT: '/inpainting/segment',
    ANALYZE_SCENE: '/inpainting/analyze-scene'
  },  
  REQUEST_TIMEOUT: 30000,  
  POLLING_INTERVAL: 2000,  
  TASK_TIMEOUT: 300000
};

export default API_CONFIG;