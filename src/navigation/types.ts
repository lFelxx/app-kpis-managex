export type RootStackParamList = {
  Home: undefined;
  NewArqueo: undefined;
  Scanner: { arqueoId: number };
  ArqueoDetail: { arqueoId: number };
  Settings: undefined;
  Employees: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};
