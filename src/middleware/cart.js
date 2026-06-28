import * as Cart from '../repositories/cart.js';

// Calcula a quantidade de itens no carrinho (para o badge) sem criar carrinho.
// Leve: só consulta quando há usuário logado ou token de visitante na sessão.
export async function cartCount(req, _res, next) {
  try {
    if (req.session?.usuario || req.session?.cartToken) {
      const cart = await Cart.resolveCart(req, { create: false });
      req.cartCount = cart ? await Cart.count(cart.id) : 0;
    } else {
      req.cartCount = 0;
    }
  } catch (err) {
    // Badge nunca deve derrubar a página.
    console.error('Falha ao contar carrinho:', err.message);
    req.cartCount = 0;
  }
  next();
}
