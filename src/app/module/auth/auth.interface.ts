export interface IRegisterPayload {
	email: string;
	name: string;
	password: string;
	patient?:{
		contractNumber?:string
	}
}

export interface ILoginPayload {
	email: string;
	password: string;
}

export interface IGetMePayload {
	userId: string;
	name: string;
	email: string;
	role: string;
}


export interface IGooglePayload {
	idToken:string
}

