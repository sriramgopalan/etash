import { HttpResponse, http } from "msw";

export const handlers = [
  http.post("https://api.resend.com/emails", () => {
    return HttpResponse.json({ id: "mock-email-id" });
  }),
];
