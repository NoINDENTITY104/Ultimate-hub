export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  cloutLink?: string;
}

export interface User {
  name: string;
  email: string;
  isOwner: boolean;
  address?: string;
}

export interface CartItem extends Product {
  quantity: number;
}
