async function run() {
  try {
    const res = await fetch("http://localhost:4000/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Test",
        last_name: "User",
        email: "test3@example.com",
        phone: "+251911223346",
        password: "1234QN1234!",
        fayda_id: "1234567890123458"
      })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
