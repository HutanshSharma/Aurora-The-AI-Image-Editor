
# Feature Documentation: Predictive Color Assist

### 1. Predictive Color Assist

Predictive Color Assist feature **learns a user’s editing history** and suggests **intent aware color adjustments** based on **past edits**. The system generates an **optimized future image** to help refine edits, allowing users to **fine tune their images** while maintaining **creative control**.

---

### 2. Need of this Feature

- While **AI auto enhance tools** exist, they are often **too generic** and lack the ability to provide personalized results. On the other hand, **manual controls** for **color** and **tone adjustments** are time consuming and challenging for users to balance with speed.

---

### 3. Workflow

```plaintext
                                START
                                  |
                                  v
                   [User edits photo normally]
                                  |
                                  v
               [User opens history strip and taps a past edit (i)]
                                  |
                                  v
                               [Split Edits]:
                    branchEdits = edits[0..i]
                    futureEdits = edits[i+1..end]
                                  |
                                  v
               [Rebuild branchImageFull by replaying branchEdits]
                                  |
                                  v
               [Create low-res branchImageLow from branchImageFull]
                                  |
                                  v
        [Compute tone state at S from branchEdits -> state_S]
      [Compute tone state at F from all edits -> state_F]
                                  |
                                  v
             [Compute deltas Δ (brightness, contrast, LUT strength)]
                                  |
                                  v
                [Build intentVector from Δ and curve points]
                                  |
                                  v
         [Generate small set of candidate parameters around user's values]
                                  |
                                  v
                               FOR each candidate:
                                  |
                        +--> [Run NeurOP ONNX on branchImageLow with candidate tone params]
                        |          → toneCandidateLow
                        |
                        +--> [Apply Image-Adaptive 3D LUT with candidate LUT strength]
                        |          → lutCandidateLow
                        |
                        +--> [Compute metrics (clipping, saturation)]
                        |
                        +--> [Score image with NIMA-lite-inspired aesthetic logic]
                        |
                        +--> [Reject if bad; keep if valid]
                                  |
                                  v
                 [Select valid candidate with highest aesthetic score]
                                  |
                                  v
                 IF no valid candidates:
                    use user’s original parameters as bestParams
                ELSE:
                    bestParams = selected candidate’s parameters
                                  |
                                  v
                  [Send bestParams (numbers only) back to device]
                                  |
                                  v
                   [Device clamps bestParams safely]
                                  |
                                  v
                     [Build tone LUT from brightness, contrast]
                                  |
                                  v
                  [Apply tone LUT + LUT style to FULL-RES branchImageFull]
                                  |
                                  v
                 [Get aiBranchImageFull (AI-optimised future)]
                                  |
                                  v
                [Show aiBranchImageFull in UI]
      [Press & hold → show userFutureImageFull]
                                  |
                                  v
                          User decision:
                                 |
                        +--> Accept:
                        |       [Insert AI-optimised edit into history]
                        |       [Update timeline / branch]
                        |
                        +--> Reject:
                               [Leave history unchanged]
                                  |
                                  v
                                 END
```

### 4. **NeurOP and NIMA-lite Explanation**

#### **NeurOP (Neural Operator)**

NeurOP is a **neural network based model** designed for **tone and color prediction**. It is particularly focused on providing high-quality **image adjustments** such as **brightness** and **contrast**, making it suitable for enhancing the aesthetic quality of images.

- **How it works**: The model **learns** from previous edits (e.g., brightness, contrast, LUT changes) and uses this knowledge to predict how future edits will affect the image.
- **Integration in Predictive Color Assist**: We use **NeurOP ONNX** to process the image, simulating tone adjustments like **brightness** and **contrast** based on the user's historical preferences.

#### **NIMA lite (NIMA Lite inspired Aesthetic Scoring)**

**NIMA lite** is a lightweight approach inspired by the **NIMA** (Neural Image Assessment) model, which **scores images based on aesthetic quality**. NIMA lite is used to evaluate how **visually appealing** an image is after applying certain adjustments.

- **How it works**: The model **scores images** based on metrics like **contrast balance**, **mid tone details**, and **color consistency**, helping to choose the most aesthetically pleasing edits.
- **Integration in Predictive Color Assist**: NIMA lite inspired logic is used to **score each candidate** image generated during the predictive branching process, selecting the one with the **highest aesthetic score**.



### 5. **Scope of the Current Feature**

Currently, the **Predictive Color Assist** feature is focused on **brightness**, **contrast**, **saturation** and **LUTs** for tone and color adjustments. Future expansions could include more complex adjustments.
