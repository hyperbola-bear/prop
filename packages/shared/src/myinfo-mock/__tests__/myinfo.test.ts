import { afterEach, describe, expect, it } from "vitest";
import { getMyInfoMockPayload, isMyInfoEnabled } from "../index";

afterEach(() => {
  delete process.env.AUTH_MYINFO_ENABLED;
});

describe("getMyInfoMockPayload", () => {
  it("returns the stable MyInfo mock payload shape", () => {
    expect(getMyInfoMockPayload()).toEqual({
      name: "Tan Wei Ming",
      uinfin: "S1234567A",
      nationality: "SG",
      dob: "1990-05-12",
      sex: "M",
      mobileno: "+6581234567"
    });
  });
});

describe("isMyInfoEnabled", () => {
  it("returns true only when AUTH_MYINFO_ENABLED is true", () => {
    process.env.AUTH_MYINFO_ENABLED = "true";
    expect(isMyInfoEnabled()).toBe(true);

    process.env.AUTH_MYINFO_ENABLED = "false";
    expect(isMyInfoEnabled()).toBe(false);

    delete process.env.AUTH_MYINFO_ENABLED;
    expect(isMyInfoEnabled()).toBe(false);
  });
});
