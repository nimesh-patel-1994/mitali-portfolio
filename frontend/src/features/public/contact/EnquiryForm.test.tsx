import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ApiError, EnquiryCreate } from "@/api/types";
import { render as renderServer } from "@/entry-server";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

/** Contract-shaped responses for createEnquiry (POST /api/public/enquiries). */
const ENDPOINT = "*/api/public/enquiries";
const requests: EnquiryCreate[] = [];

function respondWith(...responses: Array<() => Response | Promise<Response>>) {
  let call = 0;
  server.use(
    http.post(ENDPOINT, async ({ request }) => {
      requests.push((await request.json()) as EnquiryCreate);
      const next = responses[Math.min(call, responses.length - 1)]!;
      call += 1;
      return next();
    }),
  );
}

const created = () => HttpResponse.json({ received: true as const }, { status: 201 });
const apiError = (status: number, error: ApiError["error"], headers?: Record<string, string>) =>
  HttpResponse.json<ApiError>({ error }, { status, headers });

const server = setupServer(
  http.post(ENDPOINT, async ({ request }) => {
    requests.push((await request.json()) as EnquiryCreate);
    return created();
  }),
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => server.close());

async function openContact() {
  await renderRoute("/contact");
  const form = screen.getByRole("form", { name: "Enquiry form" });
  return { form, user: userEvent.setup() };
}

function field(name: RegExp | string): HTMLElement {
  return within(screen.getByRole("form")).getByLabelText(name);
}

const nameField = () => field(/^Name/);
const emailField = () => field(/^Email/);
const messageField = () => field(/^Message/);
const submitButton = () => within(screen.getByRole("form")).getByRole("button", { name: /Send enquiry|Sending/ });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(nameField(), "  Asha Rao  ");
  await user.type(emailField(), " asha@example.com ");
  await user.selectOptions(field(/^Enquiry type/), "seo_content");
  await user.selectOptions(field(/^Budget range/), "3000_7500");
  await user.type(field(/^Company/), "Harbour Tea Co.");
  await user.type(messageField(), "We need a content plan for a spring launch.");
}

describe("UI-T-060 contact form: submit empty", () => {
  it("errors on Name, Email and Message; focus on Name; nothing sent", async () => {
    const { user } = await openContact();
    await user.click(submitButton());
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(nameField()).toHaveAccessibleDescription("Enter your name.");
    expect(emailField()).toHaveAccessibleDescription("Enter your email address.");
    expect(messageField()).toHaveAccessibleDescription(/Write a short message about your project\./);
    expect(document.activeElement).toBe(nameField());
    expect(requests).toHaveLength(0);
  });

  it("revalidates on change after the first attempt", async () => {
    const { user } = await openContact();
    await user.click(submitButton());
    await user.type(nameField(), "Asha");
    expect(nameField()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Enter your name.")).toBeNull();
  });
});

describe("UI-T-061 contact form: invalid values", () => {
  it("malformed email, 5001-character message and whitespace-only name show field errors; nothing sent", async () => {
    const { user } = await openContact();
    await user.type(nameField(), "    ");
    await user.type(emailField(), "asha@");
    fireEvent.change(messageField(), { target: { value: "x".repeat(5001) } });
    expect(screen.getByText("5001 of 5000 characters")).toBeInTheDocument();
    await user.click(submitButton());
    expect(nameField()).toHaveAccessibleDescription("Enter your name.");
    expect(emailField()).toHaveAccessibleDescription("Enter an email address like name@example.com.");
    expect(messageField()).toHaveAccessibleDescription(/Keep your message to 5,000 characters or fewer\./);
    expect(document.activeElement).toBe(nameField());
    expect(requests).toHaveLength(0);
  });
});

describe("UI-T-062 contact form: success", () => {
  it("sends a trimmed EnquiryCreate body with an empty honeypot; confirmation replaces the form and takes focus", async () => {
    const { user } = await openContact();
    await fillValid(user);
    await user.click(submitButton());
    const heading = await screen.findByRole("heading", { level: 2, name: "Message received" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole("form")).toBeNull();
    expect(requests).toEqual([
      {
        name: "Asha Rao",
        email: "asha@example.com",
        enquiry_type: "seo_content",
        budget_range: "3000_7500",
        company: "Harbour Tea Co.",
        message: "We need a content plan for a spring launch.",
        website: "",
      },
    ]);
  });

  it("optional fields left empty are sent as null", async () => {
    const { user } = await openContact();
    await user.type(nameField(), "Asha");
    await user.type(emailField(), "asha@example.com");
    await user.type(messageField(), "Hello");
    await user.click(submitButton());
    await screen.findByRole("heading", { name: "Message received" });
    expect(requests[0]).toMatchObject({ enquiry_type: "content_strategy", budget_range: null, company: null });
  });
});

describe("UI-T-063 contact form: server validation error", () => {
  it("422 with fields.email puts the error on Email, focuses it and keeps the input", async () => {
    respondWith(() =>
      apiError(422, { code: "validation_error", message: "Invalid input", fields: { email: "Use a real address." } }),
    );
    const { user } = await openContact();
    await fillValid(user);
    await user.click(submitButton());
    await waitFor(() => expect(emailField()).toHaveAttribute("aria-invalid", "true"));
    expect(emailField()).toHaveAccessibleDescription("Use a real address.");
    expect(document.activeElement).toBe(emailField());
    expect(nameField()).toHaveValue("  Asha Rao  ");
    expect(messageField()).toHaveValue("We need a content plan for a spring launch.");
  });

  it("422 without known fields shows a form-level alert", async () => {
    respondWith(() => apiError(422, { code: "validation_error", message: "Invalid", fields: { website: "x" } }));
    const { user } = await openContact();
    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Some details need another look.");
  });
});

describe("UI-T-064 contact form: rate limited", () => {
  it("429 rate_limited shows the try-again-later alert and keeps all input", async () => {
    respondWith(() => apiError(429, { code: "rate_limited", message: "Too many" }, { "Retry-After": "600" }));
    const { user } = await openContact();
    await fillValid(user);
    await user.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You've sent several messages in a short time. Please try again later.");
    expect(nameField()).toHaveValue("  Asha Rao  ");
    expect(field(/^Company/)).toHaveValue("Harbour Tea Co.");
    expect(submitButton()).toBeEnabled();
  });
});

describe("UI-T-065 contact form: server and network errors, then retry", () => {
  it("500 → banner with the contact email; network error → banner; retry → 201", async () => {
    respondWith(
      () => apiError(500, { code: "internal_error", message: "Server error" }),
      () => HttpResponse.error(),
      created,
    );
    const { user } = await openContact();
    await fillValid(user);

    await user.click(submitButton());
    let alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your message didn't send.");
    expect(within(alert).getByRole("link", { name: fx.site.settings.contact_email })).toHaveAttribute(
      "href",
      `mailto:${fx.site.settings.contact_email}`,
    );
    expect(messageField()).toHaveValue("We need a content plan for a spring launch.");

    await user.click(submitButton());
    await waitFor(() => expect(requests).toHaveLength(2));
    alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your message didn't send.");
    expect(nameField()).toHaveValue("  Asha Rao  ");

    await user.click(submitButton());
    expect(await screen.findByRole("heading", { name: "Message received" })).toBeInTheDocument();
    expect(requests).toHaveLength(3);
  });
});

describe("UI-T-066 contact form: double submit", () => {
  it("double-click with a delayed response sends one request; button loading and disabled; fields read-only", async () => {
    respondWith(async () => {
      await delay(150);
      return created();
    });
    const { user } = await openContact();
    await fillValid(user);
    await user.dblClick(submitButton());
    const button = submitButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Sending…");
    expect(nameField()).toHaveAttribute("readonly");
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading", { name: "Message received" });
    expect(requests).toHaveLength(1);
  });
});

describe("UI-T-067 contact form: server render and honeypot", () => {
  it("submit disabled before hydration, <noscript> email line, method=post, honeypot attributes", async () => {
    const result = await renderServer("/contact", {
      source: createFixtureSource(),
      siteUrl: "https://mitali.example.com",
    });
    const doc = new DOMParser().parseFromString(`<body>${result.html}</body>`, "text/html");
    const form = doc.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.hasAttribute("novalidate")).toBe(true);
    expect(form.hasAttribute("action")).toBe(false);
    expect(form.querySelector('button[type="submit"]')!.hasAttribute("disabled")).toBe(true);
    expect(result.html).toContain("<noscript>");
    expect(result.html).toContain("This form needs JavaScript. You can email me instead at");
    expect(result.html).toContain(`mailto:${fx.site.settings.contact_email}`);

    const honeypot = form.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(honeypot.getAttribute("tabindex")).toBe("-1");
    expect(honeypot.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot.getAttribute("autocomplete")).toBe("off");
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(result.html).not.toMatch(/\sstyle=/);
  });

  it("after hydration (client render) the submit button is enabled", async () => {
    await openContact();
    expect(submitButton()).toBeEnabled();
  });

  it("a filled honeypot still gets the normal confirmation", async () => {
    const { user } = await openContact();
    await fillValid(user);
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="website"]')!, {
      target: { value: "https://spam.example" },
    });
    await user.click(submitButton());
    expect(await screen.findByRole("heading", { name: "Message received" })).toBeInTheDocument();
    expect(requests[0]?.website).toBe("https://spam.example");
  });
});

describe("UI-T-068 contact form: selects and labels", () => {
  it("6 enquiry types; optional budget with 6 ranges and no currency symbol; labels linked to fields", async () => {
    await openContact();
    const type = field(/^Enquiry type/) as HTMLSelectElement;
    expect(Array.from(type.options).map((o) => o.textContent)).toEqual([
      "Content strategy",
      "Copywriting",
      "SEO content",
      "Brand messaging",
      "Campaign planning",
      "Other",
    ]);
    const budget = field(/^Budget range/) as HTMLSelectElement;
    const ranges = Array.from(budget.options).filter((o) => o.value !== "");
    expect(ranges.map((o) => o.textContent)).toEqual([
      "Under 1,000",
      "1,000–3,000",
      "3,000–7,500",
      "7,500–15,000",
      "Over 15,000",
      "Not sure",
    ]);
    expect(budget.value).toBe("");
    expect(budget.textContent).not.toMatch(/[£$€₹]/);
    expect(screen.getByText("Budget range").closest("label")).toHaveTextContent("(optional)");

    for (const label of [/^Name/, /^Email/, /^Enquiry type/, /^Budget range/, /^Company/, /^Message/]) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(nameField()).toHaveAccessibleName("Name (required)");
    expect(emailField()).toHaveAttribute("type", "email");
    expect(emailField()).toHaveAttribute("autocomplete", "email");
    expect(screen.getByText(/I use your details only to reply/)).toBeInTheDocument();
  });
});

describe("Contact page layout", () => {
  it("one h1, promise, mailto contact email and the FAQ preview", async () => {
    await openContact();
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("link", { name: fx.site.settings.contact_email })).toHaveAttribute(
      "href",
      `mailto:${fx.site.settings.contact_email}`,
    );
    expect(within(main).getByRole("region", { name: "Good questions" })).toBeInTheDocument();
  });
});
