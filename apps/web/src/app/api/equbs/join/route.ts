import { NextRequest, NextResponse } from 'next/server';
import { jwtDecode } from 'jwt-decode';

interface JoinRequest {
  tier_type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

interface DecodedToken {
  sub: string;
  phone: string;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * POST /api/equbs/join
 * User joins an equb tier
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

    // Decode token to get user info
    let userInfo: DecodedToken;
    try {
      userInfo = jwtDecode<DecodedToken>(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: JoinRequest = await request.json();

    // Validate tier type
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(body.tier_type)) {
      return NextResponse.json(
        { error: 'Invalid tier type' },
        { status: 400 }
      );
    }

    // Call backend API to join equb
    const backendResponse = await fetch('http://localhost:4000/api/v1/equbs/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        tier_type: body.tier_type,
        user_id: userInfo.sub,
        user_name: `${userInfo.first_name} ${userInfo.last_name}`,
        phone: userInfo.phone,
        email: userInfo.email,
      }),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      console.error('Backend response error:', backendResponse.status, error);
      let errorData;
      try {
        errorData = JSON.parse(error);
      } catch {
        errorData = { error: 'Backend error: ' + error };
      }
      return NextResponse.json(
        errorData,
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully joined equb',
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Join equb API error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
