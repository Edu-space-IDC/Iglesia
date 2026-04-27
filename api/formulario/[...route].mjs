import { handleAdminRequest } from '../../server/admin-server.mjs';

export default {
  async fetch(request) {
    return handleAdminRequest(request);
  },
};
