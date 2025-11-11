import { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext();

export function UserProvider({ children, addToast }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
    async function fetchUser() {
        try {
        const response = await fetch("http://localhost:8000/user/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionStorage.getItem("access_token")}`,
          },
        });
        if (response.status === 401) {
          const resData = await response.json();
          if (resData.detail === "Token has expired") {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              return fetchUser();
            }
            else {
              localStorage.removeItem('refresh_token')
              addToast("Session expired. Please log in again.", "error");
              return;
            }
          }
        }
        else{
          const data = await response.json();
          if (!response.ok) {
            localStorage.removeItem('refresh_token')
            addToast(data.detail || "Could not validate user", "error");
            return;
          }
          setUser(data);
        }
      } catch (error) {
        if(localStorage.getItem('refresh_token'))
          addToast("Network error while validating user", "error");
        localStorage.removeItem('refresh_token')
        return
      }
    }
    fetchUser();
    }, []);

    async function refreshAccessToken() {
    try {
        const res = await fetch("http://localhost:8000/auth/generate_new_access_token", {
            method: "POST",
            body: JSON.stringify({
            'refresh_token': localStorage.getItem("refresh_token"),
            }),
            headers: {
            "Content-Type": "application/json",
            },
        });

        const data = await res.json();
        if (!res.ok) {
            addToast(data.detail, 'error');
            return false;
        }
        sessionStorage.setItem("access_token", data.access_token);
        return true;
    } 
    catch (error) {
        addToast("Vaildation Failed", 'invalid');
        return false;
    }
    }

    return (
        <UserContext.Provider value={{ user, setUser }}>
        {children}
        </UserContext.Provider>
    );
}

export function useUser() {
  return useContext(UserContext);
}
