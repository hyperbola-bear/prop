export type MyInfoMockPayload = {
  name: "Tan Wei Ming";
  uinfin: "S1234567A";
  nationality: "SG";
  dob: "1990-05-12";
  sex: "M";
  mobileno: "+6581234567";
};

const MYINFO_MOCK_PAYLOAD: MyInfoMockPayload = {
  name: "Tan Wei Ming",
  uinfin: "S1234567A",
  nationality: "SG",
  dob: "1990-05-12",
  sex: "M",
  mobileno: "+6581234567"
};

export function isMyInfoEnabled(): boolean {
  return process.env.AUTH_MYINFO_ENABLED === "true";
}

export function getMyInfoMockPayload(): MyInfoMockPayload {
  return { ...MYINFO_MOCK_PAYLOAD };
}
