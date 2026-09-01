import { NextRequest, NextResponse } from 'next/server';

interface DepositRequest {
  phone: string;
  pin: string;
  amount: number;
  paymentMethod: string;
}

interface DepositResponse {
  success: boolean;
  transactionId: string;
  amount: number;
  status: string;
  message: string;
  timestamp: string;
}

/**
 * POST /api/wallet/deposit
 * Process a wallet deposit request
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Parse request body
    const body: DepositRequest = await request.json();

    // Validate required fields
    if (!body.phone || !body.pin || !body.amount || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate phone format
    const phoneRegex = /^\+251\d{9}$/;
    if (!phoneRegex.test(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone format' },
        { status: 400 }
      );
    }

    // Validate PIN format
    if (!/^\d{4}$/.test(body.pin)) {
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      );
    }

    // Validate amount
    if (body.amount < 50 || body.amount > 999999) {
      return NextResponse.json(
        { error: 'Amount must be between 50 and 999,999 ETB' },
        { status: 400 }
      );
    }

    // Validate payment method
    const validMethods = ['telebirr', 'cbe', 'abyssinia', 'dashen', 'awash', 'nib'];
    if (!validMethods.includes(body.paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Forward to backend
    const backendResponse = await fetch('http://localhost:4000/api/wallet/deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.json();
      return NextResponse.json(
        error,
        { status: backendResponse.status }
      );
    }

    const data: DepositResponse = await backendResponse.json();

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Deposit API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
