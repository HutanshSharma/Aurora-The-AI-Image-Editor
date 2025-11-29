import { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext();

export function UserProvider({ children, addToast }) {
    const [user, setUser] = useState(null);
    const [imageCache, setImageCache] = useState(new Map());
    
    const fetchImage = async (stored_name) => {
        if (imageCache.has(stored_name)) {
            return imageCache.get(stored_name);
        }
        
        try {
            const accessToken = sessionStorage.getItem("access_token");
            if (!accessToken) {
                throw new Error("No access token available");
            }
            
            const response = await fetch(`http://localhost:8000/user/image/${stored_name}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return fetchImage(stored_name);
                    }
                }
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            
            const imageData = await response.json();
            
            setImageCache(prev => new Map(prev.set(stored_name, imageData)));
            
            return imageData;
        } catch (error) {
            console.error("Error fetching image:", error);
            addToast("Failed to load image", "error");
            return null;
        }
    };

    const deleteImage = async (stored_name) => {
        try {
            const accessToken = sessionStorage.getItem("access_token");
            if (!accessToken) {
                throw new Error("No access token available");
            }
            
            const response = await fetch(`http://localhost:8000/user/delete-image/${stored_name}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`,
                },
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return deleteImage(stored_name);
                    }
                }
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to delete image: ${response.status}`);
            }
            
            const result = await response.json();
            
            setImageCache(prev => {
                const newCache = new Map(prev);
                newCache.delete(stored_name);
                return newCache;
            });
            
            setUser(prevUser => {
                if (!prevUser || !prevUser.images) return prevUser;
                
                return {
                    ...prevUser,
                    images: prevUser.images.filter(img => img.stored_name !== stored_name)
                };
            });
            
            addToast(`Image deleted successfully`, "success");
            return result;
        } catch (error) {
            console.error("Error deleting image:", error);
            addToast(error.message || "Failed to delete image", "error");
            throw error;
        }
    };

    useEffect(() => {
    async function fetchUser() {
        try {
        const accessToken = sessionStorage.getItem("access_token");
        const refreshToken = localStorage.getItem("refresh_token");
                
        if (!accessToken) {
            console.log("No access token found, trying to refresh...");
            if (refreshToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return fetchUser();
                } else {
                    localStorage.removeItem('refresh_token');
                    addToast("Please log in to continue.", "error");
                    return;
                }
            } else {
                return;
            }
        }

        const response = await fetch("http://localhost:8000/user/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
        });
        console.log("Response status:", response.status);
        
        if (response.status === 401) {
          const resData = await response.json();
          console.log("401 error details:", resData);
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            console.log("Token refreshed, retrying...");
            return fetchUser();
          } else {
            localStorage.removeItem('refresh_token');
            sessionStorage.removeItem('access_token');
            addToast("Session expired. Please log in again.", "error");
            return;
          }
        }
        
        const data = await response.json();
        if (!response.ok) {
          console.log("Response not ok:", data);
          localStorage.removeItem('refresh_token');
          sessionStorage.removeItem('access_token');
          addToast(data.detail || "Could not validate user", "error");
          return;
        }
        
        console.log("User data fetched successfully:", data);
        setUser(data);
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
        const refreshToken = localStorage.getItem("refresh_token");
        console.log("Attempting to refresh with token:", refreshToken?.substring(0, 20) + "...");
        
        const res = await fetch("http://localhost:8000/auth/generate_new_access_token", {
            method: "POST",
            body: JSON.stringify({
            'refresh_token': refreshToken,
            }),
            headers: {
            "Content-Type": "application/json",
            },
        });

        console.log("Refresh response status:", res.status);
        const data = await res.json();
        
        if (!res.ok) {
            console.log("Refresh failed:", data);
            addToast(data.detail, 'error');
            return false;
        }
        
        console.log("Token refreshed successfully");
        sessionStorage.setItem("access_token", data.access_token);
        return true;
    } 
    catch (error) {
        addToast("Vaildation Failed", 'invalid');
        return false;
    }
    }

    return (
        <UserContext.Provider value={{ user, setUser, fetchImage, deleteImage, imageCache }}>
        {children}
        </UserContext.Provider>
    );
}

export function useUser() {
  return useContext(UserContext);
}
